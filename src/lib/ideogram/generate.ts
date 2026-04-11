import { Anthropic } from '@/lib/ai/anthropic-compat'
import { pickModel } from '@/lib/ai/router'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export type ImageType = 'quote' | 'carousel' | 'abstract'

export async function generatePostImage(
  userId: string,
  postContent: string,
  imageType: ImageType
): Promise<string> {
  const supabase = getSupabaseAdmin()
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const { data: user } = await supabase
    .from('users')
    .select('name, brand_kit')
    .eq('id', userId)
    .single()

  // Extract key line for quote/carousel
  const keyLineRes = await anthropic.messages.create({
    model: pickModel('image-prompt'),
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: `Extract the single most memorable line from this post. Max 12 words. Output ONLY the line:\n${postContent}`,
      },
    ],
  })
  const keyLine =
    keyLineRes.content[0].type === 'text'
      ? keyLineRes.content[0].text.trim()
      : ''

  const prompts: Record<ImageType, string> = {
    quote: `Minimalist dark background typography poster. Large sans-serif text: "${keyLine}". Small attribution text: "${user?.name}". No decorations. Editorial style. Professional LinkedIn graphic. Black background, white text. High contrast.`,
    carousel: `Slide 1 of a LinkedIn thought leadership carousel. Bold statement: "${keyLine}". Dark background. White typography. Clean minimal layout. No borders, no gradients.`,
    abstract: `Abstract minimal background graphic for professional LinkedIn post. Mood: thoughtful and authoritative. Dark background with subtle geometric elements. No text. Professional, clean.`,
  }

  const res = await fetch('https://api.ideogram.ai/generate', {
    method: 'POST',
    headers: {
      'Api-Key': process.env.IDEOGRAM_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_request: {
        prompt: prompts[imageType],
        aspect_ratio: 'ASPECT_1_1',
        model: 'V_2',
        magic_prompt_option: 'OFF',
        style_type: 'DESIGN',
      },
    }),
  })

  const data = await res.json()
  const imageUrl = data.data?.[0]?.url
  if (!imageUrl) throw new Error('Ideogram generation failed')

  // Download and store in Supabase storage
  const imgRes = await fetch(imageUrl)
  const imgBuffer = await imgRes.arrayBuffer()
  const filename = `${userId}/${Date.now()}.jpg`

  await supabase.storage
    .from('post-images')
    .upload(filename, imgBuffer, {
      contentType: 'image/jpeg',
      upsert: false,
    })

  const {
    data: { publicUrl },
  } = supabase.storage.from('post-images').getPublicUrl(filename)
  return publicUrl
}
