import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getEnv } from '@/lib/config'
import { generateDailyPost } from '@/lib/claude/generatePost'
import { sendWhatsApp } from '@/lib/whatsapp/send'

/**
 * Transcribe a WhatsApp voice note via Gemini 2.5 Flash
 * and generate a post from the transcript.
 */
export async function handleVoiceNote(
  userId: string,
  audioId: string,
  messageId?: string
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { data: user } = await supabase
    .from('users')
    .select('whatsapp_number')
    .eq('id', userId)
    .single()

  if (!user?.whatsapp_number) return

  await sendWhatsApp(
    user.whatsapp_number,
    '🎤 got your voice note. transcribing now...'
  )

  // Download audio via Unipile
  let audioBuffer: ArrayBuffer
  let mimeType: string
  try {
    const downloadUrl = messageId && audioId
      ? `${process.env.UNIPILE_BASE_URL}/api/v1/messages/${messageId}/attachments/${audioId}`
      : `${process.env.UNIPILE_BASE_URL}/api/v1/media/${audioId}`

    const audioRes = await fetch(downloadUrl, {
      headers: { 'X-API-KEY': process.env.UNIPILE_API_KEY! },
    })
    if (!audioRes.ok) {
      console.error('[voiceNote] download failed:', audioRes.status)
      await sendWhatsApp(user.whatsapp_number, 'couldnt download the voice note, try again?')
      return
    }
    audioBuffer = await audioRes.arrayBuffer()
    mimeType = audioRes.headers.get('content-type') ?? 'audio/ogg'
  } catch (err) {
    console.error('[voiceNote] download error:', err)
    await sendWhatsApp(user.whatsapp_number, 'couldnt download the voice note, try again?')
    return
  }

  // Transcribe with Gemini
  const base64 = Buffer.from(audioBuffer).toString('base64')
  const transcript = await transcribeWithGemini(base64, mimeType)

  if (!transcript) {
    await sendWhatsApp(user.whatsapp_number, 'couldnt understand that voice note. try typing it or send another?')
    return
  }

  // Save transcript as conversation
  await supabase.from('conversations').insert({
    user_id: userId,
    role: 'user',
    content: `[voice note] ${transcript}`,
  })

  // Generate post from transcript
  try {
    const post = await generateDailyPost(userId, transcript)
    await sendWhatsApp(
      user.whatsapp_number,
      `here's your post from the voice note:\n\n${post.content}\n\nreply POST to publish, EDIT to change, or SKIP`
    )
  } catch {
    await sendWhatsApp(
      user.whatsapp_number,
      `transcribed your voice note:\n\n"${transcript}"\n\nwant me to turn this into a post?`
    )
  }
}

/**
 * Transcribe with Gemini 2.5 Flash (multimodal audio)
 */
async function transcribeWithGemini(base64Audio: string, mimeType: string): Promise<string | null> {
  const apiKey = getEnv('GEMINI_API_KEY')
  if (!apiKey) return null

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Transcribe this voice note verbatim. Output only the spoken words, no formatting, no labels, no commentary.' },
              { inline_data: { mime_type: mimeType, data: base64Audio } },
            ],
          }],
          generationConfig: { maxOutputTokens: 2048, temperature: 0.1 },
        }),
      }
    )

    const data = await res.json()
    if (data.error) {
      console.error('[voiceNote] Gemini error:', data.error.message)
      return null
    }
    return (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim() || null
  } catch (err) {
    console.error('[voiceNote] Gemini failed:', err)
    return null
  }
}
