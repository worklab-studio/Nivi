import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getEnv } from '@/lib/config'
import { sendWhatsApp } from '@/lib/whatsapp/send'

/**
 * Transcribe a WhatsApp voice note via Gemini 2.5 Flash,
 * then route the transcript through handleConversation so Nivi
 * replies based on intent (chat, post draft, tool call, etc.) —
 * not always as a post draft.
 */
export async function handleVoiceNote(
  userId: string,
  audioId: string,
  messageId?: string,
  chatId?: string
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { data: user } = await supabase
    .from('users')
    .select('id, name, whatsapp_number, unipile_account_id, timezone, niche, plan, streak_count, onboarding_complete')
    .eq('id', userId)
    .single()

  if (!user?.whatsapp_number) return

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
      await sendWhatsApp(user.whatsapp_number, 'couldnt download the voice note, try again?', chatId)
      return
    }
    audioBuffer = await audioRes.arrayBuffer()
    mimeType = audioRes.headers.get('content-type') ?? 'audio/ogg'
  } catch (err) {
    console.error('[voiceNote] download error:', err)
    await sendWhatsApp(user.whatsapp_number, 'couldnt download the voice note, try again?', chatId)
    return
  }

  // Transcribe with Gemini
  const base64 = Buffer.from(audioBuffer).toString('base64')
  const transcript = await transcribeWithGemini(base64, mimeType)

  if (!transcript) {
    await sendWhatsApp(user.whatsapp_number, 'couldnt understand that voice note. try typing it or send another?', chatId)
    return
  }

  console.log(`[voiceNote] transcribed for ${user.name}: "${transcript.slice(0, 80)}"`)

  // Route through conversation handler — Nivi figures out intent and replies naturally
  const { handleConversation } = await import('@/lib/whatsapp/handlers/conversation')
  const fullUser = {
    ...user,
    chatId: chatId ?? '',
    timezone: user.timezone || 'Asia/Kolkata',
    niche: user.niche || null,
    plan: user.plan || 'free',
    streak_count: user.streak_count || 0,
    onboarding_complete: user.onboarding_complete ?? true,
  }
  await handleConversation(userId, fullUser, `[voice note transcript] ${transcript}`)
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
