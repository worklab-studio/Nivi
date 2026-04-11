import { auth } from '@clerk/nextjs/server'

/**
 * Fetch text content from a URL. Currently supports:
 *   - YouTube video URLs → fetches the auto/manual transcript
 *
 * Could be extended to handle generic article URLs via Jina Reader later.
 */

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

export async function POST(req: Request) {
  console.log('[knowledge/fetch-url] entered POST')
  try {
    const { userId } = await auth()
    if (!userId)
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return Response.json(
        { ok: false, error: 'url required' },
        { status: 400 }
      )
    }

    // YouTube
    if (/youtube\.com|youtu\.be/i.test(url)) {
      const videoId = extractYouTubeId(url)
      if (!videoId) {
        return Response.json(
          { ok: false, error: 'Could not parse YouTube video ID from URL' },
          { status: 400 }
        )
      }

      const { YoutubeTranscript } = await import('youtube-transcript')
      let segments: { text: string }[] = []
      try {
        segments = await YoutubeTranscript.fetchTranscript(videoId)
      } catch (e) {
        return Response.json(
          {
            ok: false,
            error: `Could not fetch YouTube transcript: ${(e as Error).message}. The video may have transcripts disabled.`,
          },
          { status: 502 }
        )
      }

      const text = segments
        .map((s) => s.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .replace(/\[.*?\]/g, '') // strip [Music], [Applause], etc.
        .trim()

      if (text.length < 50) {
        return Response.json(
          { ok: false, error: 'Transcript too short or empty' },
          { status: 400 }
        )
      }

      // Try to fetch the video title from YouTube oEmbed (no API key needed)
      let suggestedTitle = `YouTube: ${videoId}`
      try {
        const oembedRes = await fetch(
          `https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${videoId}&format=json`
        )
        if (oembedRes.ok) {
          const oembed = await oembedRes.json()
          if (oembed.title) suggestedTitle = oembed.title
        }
      } catch {
        // Ignore, use default title
      }

      const words = text.split(/\s+/).filter(Boolean).length
      console.log('[knowledge/fetch-url] youtube', videoId, words, 'words')

      return Response.json({
        ok: true,
        text,
        suggestedTitle,
        words,
        sourceType: 'video',
      })
    }

    return Response.json(
      {
        ok: false,
        error: 'Only YouTube URLs are supported right now',
      },
      { status: 400 }
    )
  } catch (e) {
    const message = (e as Error).message ?? 'unknown error'
    console.error('[knowledge/fetch-url] failed:', message)
    return Response.json({ ok: false, error: message }, { status: 502 })
  }
}
