import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getEnv } from '@/lib/config'
import { generateDailyPost } from '@/lib/claude/generatePost'
import { sendWhatsApp } from '@/lib/whatsapp/send'

/**
 * Transcribe a WhatsApp voice note via Gemini 2.5 Flash (multimodal audio)
 * and feed the transcript into generateDailyPost(). Replaces the old
 * OpenAI Whisper path — no more OpenAI dependency in Nivi.
 */
export async function handleVoiceNote(
  userId: string,
  audioId: string
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
    '\ud83c\udfa4 Got your voice note. Writing a post from it now...'
  )

  // Download audio via Unipile
  const audioRes = await fetch(
    `${process.env.UNIPILE_BASE_URL}/api/v1/media/${audioId}`,
    {
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY!,
      },
    }
  )
  if (!audioRes.ok) {
    console.error('[voiceNote] Unipile media fetch failed:', audioRes.status)
    await sendWhatsApp(
      user.whatsapp_number,
      'hmm couldnt download that voice note, can you send it again?'
    )
    return
  }

  const audioBuffer = await audioRes.arrayBuffer()
  const base64Audio = Buffer.from(audioBuffer).toString('base64')
  // Unipile returns a content-type header for media — trust it, fall back to ogg.
  const mimeType = audioRes.headers.get('content-type') ?? 'audio/ogg'

  const transcript = await transcribeWithGemini(base64Audio, mimeType)
  if (!transcript) {
    await sendWhatsApp(
      user.whatsapp_number,
      'hmm couldnt understand that voice note. try typing it or send another?'
    )
    return
  }

  const post = await generateDailyPost(userId, transcript)

  await sendWhatsApp(
    user.whatsapp_number,
    `Here's your post from the voice note:\n\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n${post.content}\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\nReply POST / EDIT: [notes] / SKIP`
  )
}

/**
 * Call Gemini 2.5 Flash with inline audio and ask for a clean transcript.
 * Returns the transcript or null on failure.
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
          contents: [
            {
              parts: [
                {
                  text: 'Transcribe this voice note verbatim. Output only the spoken words, no formatting, no speaker labels, no commentary. If the audio is unclear or silent, return an empty string.',
                },
                { inline_data: { mime_type: mimeType, data: base64Audio } },
              ],
            },
          ],
          generationConfig: { maxOutputTokens: 2048, temperature: 0.1 },
        }),
      }
    )

    const data = await res.json()
    if (data.error) {
      console.error('[voiceNote] Gemini transcribe error:', data.error.message)
      return null
    }
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    return text.trim() || null
  } catch (err) {
    console.error('[voiceNote] Gemini transcribe failed:', err)
    return null
  }
}
