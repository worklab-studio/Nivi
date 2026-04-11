import { auth } from '@clerk/nextjs/server'
import { getEnv } from '@/lib/config'

/**
 * Knowledge source file upload + text extraction.
 *
 * Supports:
 *   - Text files (.txt, .md)
 *   - Subtitle files (.vtt, .srt) with timestamps stripped
 *   - PDFs (.pdf) via unpdf
 *   - Word docs (.docx) via mammoth
 *   - Audio/video (.mp3, .m4a, .wav, .mp4, .mov, .webm) via Gemini 2.5 Flash multimodal transcription
 *
 * Returns: { text, suggestedTitle, words }
 */

const MAX_TEXT_BYTES = 20 * 1024 * 1024 // 20MB for text-based files
const MAX_MEDIA_BYTES = 25 * 1024 * 1024 // 25MB for audio/video (Gemini inline limit)

function stripSubtitleTimestamps(raw: string): string {
  return raw
    .replace(/\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}.*/g, '')
    .replace(/^\d+\s*$/gm, '') // srt sequence numbers
    .replace(/^WEBVTT.*$/gm, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function transcribeMedia(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const apiKey = getEnv('GEMINI_API_KEY')
  const base64 = buffer.toString('base64')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Transcribe this ${mimeType.startsWith('video') ? 'video' : 'audio'} verbatim. Return ONLY the transcript text — no timestamps, no speaker labels unless clearly distinct, no commentary, no markdown. Preserve natural paragraph breaks between topic shifts.`,
              },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.1,
        },
      }),
    }
  )

  const data = await res.json()
  if (data.error) {
    throw new Error(`Gemini transcription: ${data.error.message}`)
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  if (!text) {
    throw new Error('Gemini returned empty transcription')
  }
  return text.trim()
}

export async function POST(req: Request) {
  console.log('[knowledge/upload] entered POST')
  try {
    const { userId } = await auth()
    if (!userId)
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return Response.json(
        { ok: false, error: 'No file uploaded' },
        { status: 400 }
      )
    }

    const filename = file.name
    const mimeType = file.type || ''
    const buffer = Buffer.from(await file.arrayBuffer())
    const suggestedTitle = filename.replace(/\.[^.]+$/, '')
    console.log(
      '[knowledge/upload]',
      filename,
      mimeType,
      buffer.length,
      'bytes'
    )

    let text = ''

    // ──────────────────────────────────────────
    // Text files (txt, md) + subtitles (vtt, srt)
    // ──────────────────────────────────────────
    if (
      mimeType.startsWith('text/') ||
      /\.(txt|md|vtt|srt)$/i.test(filename)
    ) {
      if (buffer.length > MAX_TEXT_BYTES) {
        return Response.json(
          { ok: false, error: 'Text file too large (max 20MB)' },
          { status: 400 }
        )
      }
      const raw = buffer.toString('utf-8')
      text = /\.(vtt|srt)$/i.test(filename)
        ? stripSubtitleTimestamps(raw)
        : raw
    }
    // ──────────────────────────────────────────
    // PDF
    // ──────────────────────────────────────────
    else if (mimeType === 'application/pdf' || /\.pdf$/i.test(filename)) {
      if (buffer.length > MAX_TEXT_BYTES) {
        return Response.json(
          { ok: false, error: 'PDF too large (max 20MB)' },
          { status: 400 }
        )
      }
      const { extractText } = await import('unpdf')
      const result = await extractText(new Uint8Array(buffer), {
        mergePages: true,
      })
      text = Array.isArray(result.text) ? result.text.join('\n\n') : result.text
    }
    // ──────────────────────────────────────────
    // DOCX
    // ──────────────────────────────────────────
    else if (
      mimeType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      /\.docx$/i.test(filename)
    ) {
      if (buffer.length > MAX_TEXT_BYTES) {
        return Response.json(
          { ok: false, error: 'Document too large (max 20MB)' },
          { status: 400 }
        )
      }
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
    }
    // ──────────────────────────────────────────
    // Audio / video → Gemini multimodal transcription
    // ──────────────────────────────────────────
    else if (
      mimeType.startsWith('audio/') ||
      mimeType.startsWith('video/') ||
      /\.(mp3|m4a|wav|ogg|flac|mp4|mov|webm|mpeg)$/i.test(filename)
    ) {
      if (buffer.length > MAX_MEDIA_BYTES) {
        return Response.json(
          {
            ok: false,
            error:
              'Media file too large (max 25MB). Try splitting into shorter clips.',
          },
          { status: 400 }
        )
      }
      // Normalize MIME if the browser didn't set one
      const inferredMime =
        mimeType ||
        (/\.mp3$/i.test(filename)
          ? 'audio/mpeg'
          : /\.m4a$/i.test(filename)
            ? 'audio/mp4'
            : /\.wav$/i.test(filename)
              ? 'audio/wav'
              : /\.mp4$/i.test(filename)
                ? 'video/mp4'
                : /\.mov$/i.test(filename)
                  ? 'video/quicktime'
                  : /\.webm$/i.test(filename)
                    ? 'video/webm'
                    : 'audio/mpeg')
      text = await transcribeMedia(buffer, inferredMime)
    }
    // ──────────────────────────────────────────
    // Unsupported
    // ──────────────────────────────────────────
    else {
      return Response.json(
        {
          ok: false,
          error: `Unsupported file type: ${mimeType || filename}. Supported: .txt .md .vtt .srt .pdf .docx .mp3 .m4a .wav .mp4 .mov .webm`,
        },
        { status: 415 }
      )
    }

    const cleanText = text.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    if (cleanText.length < 50) {
      return Response.json(
        { ok: false, error: 'Extracted text too short (min 50 chars)' },
        { status: 400 }
      )
    }

    const words = cleanText.split(/\s+/).filter(Boolean).length
    console.log('[knowledge/upload] extracted', words, 'words from', filename)

    return Response.json({
      ok: true,
      text: cleanText,
      suggestedTitle,
      words,
    })
  } catch (e) {
    const message = (e as Error).message ?? 'unknown error'
    console.error('[knowledge/upload] failed:', message)
    return Response.json({ ok: false, error: message }, { status: 502 })
  }
}
