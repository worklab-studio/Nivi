import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { getEnv } from '@/lib/config'
import { handleConversation } from '@/lib/whatsapp/handlers/conversation'

const GEMINI_MODEL = 'gemini-2.5-flash'

interface MediaAttachment {
  id: string
  type: string
  mimeType?: string
  filename?: string
  messageId?: string // Unipile message_id — needed for attachment download
}

/**
 * Handle any media (image, PDF, doc, audio) sent via WhatsApp.
 * Downloads from Unipile, sends to Gemini vision/document API, feeds result to Nivi.
 */
export async function handleMedia(
  userId: string,
  user: { whatsapp_number: string; name?: string; chatId?: string; [k: string]: unknown },
  attachment: MediaAttachment,
  caption: string
): Promise<void> {
  const supabase = getSupabaseAdmin()

  // Download the media from Unipile.
  // Correct endpoint: GET /api/v1/messages/{message_id}/attachments/{attachment_id}
  // Requires both the Unipile message_id AND the attachment_id.
  const baseUrl = getEnv('UNIPILE_BASE_URL')
  const apiKey = getEnv('UNIPILE_API_KEY')

  const messageId = attachment.messageId
  let mediaRes: Response | null = null

  if (messageId) {
    // Primary path: proper Unipile attachment download endpoint
    try {
      mediaRes = await fetch(
        `${baseUrl}/api/v1/messages/${messageId}/attachments/${attachment.id}`,
        { headers: { 'X-API-KEY': apiKey } }
      )
      console.log(
        '[media] /messages/{msg}/attachments/{att} →',
        mediaRes.status,
        mediaRes.headers.get('content-length') ?? '?',
        'bytes'
      )
    } catch (e) {
      console.error('[media] attachment download threw:', (e as Error).message)
    }
  }

  // Fallback: legacy /api/v1/media/{id} (works for voice notes on some versions)
  if (!mediaRes || !mediaRes.ok) {
    try {
      mediaRes = await fetch(`${baseUrl}/api/v1/media/${attachment.id}`, {
        headers: { 'X-API-KEY': apiKey },
      })
      console.log('[media] /media/{id} fallback →', mediaRes.status)
    } catch { /* continue */ }
  }

  if (!mediaRes || !mediaRes.ok) {
    await sendWhatsApp(
      user.whatsapp_number,
      `hmm couldnt download that file (${mediaRes?.status ?? 'network error'}). try sending it again?`,
      user.chatId
    )
    return
  }

  const rawBuffer = await mediaRes.arrayBuffer()
  const buffer = rawBuffer

  const base64 = Buffer.from(buffer).toString('base64')
  const detectedMime = mediaRes.headers.get('content-type') ?? ''
  // Detect mime type — prefer what the server told us, fall back to attachment metadata
  const mimeType = detectedMime || detectMimeType(attachment)

  // Determine how to handle it
  const isImage = mimeType.startsWith('image/')
  const isPdf = mimeType === 'application/pdf'
  const isDoc = mimeType.includes('word') || mimeType.includes('document') || mimeType.includes('officedocument')
  const isExcel = mimeType.includes('sheet') || mimeType.includes('excel')
  const isAudio = mimeType.startsWith('audio/')

  // Gemini supports images and PDFs natively
  // For images/PDFs — analyze with Gemini vision
  if (isImage || isPdf) {
    const analysis = await analyzeWithGemini(base64, mimeType, caption)

    // Store image for potential post attachment
    if (isImage) {
      try {
        const filename = `${userId}/${Date.now()}.${mimeType.split('/')[1] ?? 'jpg'}`
        await supabase.storage
          .from('post-images')
          .upload(filename, buffer, { contentType: mimeType, upsert: false })
        const { data: { publicUrl } } = supabase.storage.from('post-images').getPublicUrl(filename)
        await supabase.from('users').update({ pending_image_url: publicUrl }).eq('id', userId)
      } catch { /* skip */ }
    }

    // Feed the analysis to Nivi as context.
    // For images: the image is already saved as pending_image_url and will
    // auto-attach to the next LinkedIn post when published. Tell Nivi explicitly
    // so she can mention it naturally instead of saying "i'll just describe it".
    const imageNote = isImage
      ? ' THE IMAGE IS ALREADY UPLOADED AND WILL AUTO-ATTACH TO THE NEXT POST WHEN PUBLISHED. Just confirm with the user (e.g. "got the pic, ill use it on your next post") and either write a post around it or ask what they want to say with it.'
      : ''

    const contextualMessage = caption
      ? `[user shared ${isImage ? 'an image' : 'a PDF'} with caption: "${caption}". Content analysis: ${analysis}.${imageNote}]`
      : `[user shared ${isImage ? 'an image' : 'a PDF'}. Content analysis: ${analysis}.${imageNote}]`

    await handleConversation(userId, user, contextualMessage)
    return
  }

  // For Word/Excel — try Gemini document upload (supports docx, xlsx via files API)
  if (isDoc || isExcel) {
    await sendWhatsApp(
      user.whatsapp_number,
      `got the ${isExcel ? 'spreadsheet' : 'doc'}! give me a sec to read through it...`,
      user.chatId
    )

    // Gemini supports these via the Files API, but simpler approach: convert to text
    const text = await extractTextFromDoc(base64, mimeType, attachment.filename ?? 'file')
    if (text) {
      const contextualMessage = caption
        ? `[user shared a ${isExcel ? 'spreadsheet' : 'document'} with caption: "${caption}". Content: ${text.slice(0, 4000)}]`
        : `[user shared a ${isExcel ? 'spreadsheet' : 'document'}. Content: ${text.slice(0, 4000)}]`
      await handleConversation(userId, user, contextualMessage)
    } else {
      await sendWhatsApp(user.whatsapp_number, 'hmm couldnt read that file properly. can you paste the content or send it as text?', user.chatId)
    }
    return
  }

  // For audio — voice notes (handled separately but we can catch it here too)
  if (isAudio) {
    // Voice note handler already exists, just return
    return
  }

  // Unknown type
  await sendWhatsApp(user.whatsapp_number, "hmm not sure what that file is, can you describe it?", user.chatId)
}

/**
 * Analyze image or PDF with Gemini vision
 */
async function analyzeWithGemini(
  base64Data: string,
  mimeType: string,
  caption: string
): Promise<string> {
  const apiKey = getEnv('GEMINI_API_KEY')

  const prompt = caption
    ? `The user sent this with the message: "${caption}". Describe what you see in detail. If its a screenshot of something (LinkedIn post, analytics, article, tweet, etc), extract all the text and explain what it shows. If its a photo, describe it. Be thorough but concise.`
    : `Describe this in detail. If its a screenshot (LinkedIn post, analytics dashboard, article, tweet, chat), extract all the text and explain what it shows. If its a photo, describe whats in it. Be thorough but concise.`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: base64Data } },
            ],
          }],
          generationConfig: { maxOutputTokens: 8192, temperature: 0.4 },
        }),
      }
    )

    const data = await res.json()
    if (data.error) return `[could not analyze: ${data.error.message}]`
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[no analysis available]'
  } catch {
    return '[analysis failed]'
  }
}

/**
 * Extract text from Word/Excel docs
 */
async function extractTextFromDoc(
  base64Data: string,
  mimeType: string,
  filename: string
): Promise<string> {
  const apiKey = getEnv('GEMINI_API_KEY')

  // Gemini 2.5 can handle docx/xlsx when uploaded as inline data
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: `Extract all the text content from this file (${filename}). Preserve structure. If its a spreadsheet, describe the data. If its a document, extract all text.` },
              { inline_data: { mime_type: mimeType, data: base64Data } },
            ],
          }],
          generationConfig: { maxOutputTokens: 8192, temperature: 0.1 },
        }),
      }
    )

    const data = await res.json()
    if (data.error) return ''
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  } catch {
    return ''
  }
}

/**
 * Handle URLs sent in messages — fetch page and feed to Nivi
 */
export async function handleUrlInMessage(
  userId: string,
  user: { whatsapp_number: string; name?: string; chatId?: string; [k: string]: unknown },
  text: string,
  url: string
): Promise<void> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Nivi Assistant)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      await handleConversation(userId, user, text)
      return
    }

    const html = await res.text()
    // Simple text extraction — strip HTML tags
    const pageText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000)

    const contextualMessage = `[user shared a URL: ${url}]\nUser said: "${text}"\nPage content: ${pageText}`
    await handleConversation(userId, user, contextualMessage)
  } catch {
    // URL fetch failed, just process the message normally
    await handleConversation(userId, user, text)
  }
}

function detectMimeType(attachment: MediaAttachment): string {
  if (attachment.mimeType) return attachment.mimeType

  const type = (attachment.type ?? '').toLowerCase()
  const filename = (attachment.filename ?? '').toLowerCase()

  // Check by extension
  if (filename.endsWith('.pdf')) return 'application/pdf'
  if (filename.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (filename.endsWith('.doc')) return 'application/msword'
  if (filename.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (filename.endsWith('.xls')) return 'application/vnd.ms-excel'
  if (filename.endsWith('.png')) return 'image/png'
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg'
  if (filename.endsWith('.webp')) return 'image/webp'
  if (filename.endsWith('.mp3')) return 'audio/mp3'
  if (filename.endsWith('.ogg') || filename.endsWith('.oga')) return 'audio/ogg'

  // Fall back to type
  if (type.includes('image')) return 'image/jpeg'
  if (type.includes('pdf')) return 'application/pdf'
  if (type.includes('audio')) return 'audio/ogg'
  if (type.includes('video')) return 'video/mp4'

  return 'application/octet-stream'
}
