import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: Request) {
  const payload = await req.text()
  const headersList = await headers()
  const svixHeaders = {
    'svix-id': headersList.get('svix-id')!,
    'svix-timestamp': headersList.get('svix-timestamp')!,
    'svix-signature': headersList.get('svix-signature')!,
  }

  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!)
  const event = wh.verify(payload, svixHeaders) as {
    type: string
    data: {
      id: string
      email_addresses: { email_address: string }[]
      first_name?: string
      last_name?: string
    }
  }

  if (event.type === 'user.created') {
    const supabaseAdmin = getSupabaseAdmin()
    await supabaseAdmin.from('users').insert({
      id: event.data.id,
      email: event.data.email_addresses[0].email_address,
      name:
        `${event.data.first_name ?? ''} ${event.data.last_name ?? ''}`.trim() ||
        'User',
      // Stagger posting_time across new signups so 500 accounts don't all
      // publish at exactly 09:00 from Unipile's IPs (a vendor-level cluster
      // signature LinkedIn picks up on). Range: 08:00–11:30 in 15-min slots.
      posting_time: randomMorningTime(),
    })
  }

  return Response.json({ success: true })
}

function randomMorningTime(): string {
  const slots: string[] = []
  for (let h = 8; h <= 11; h++) {
    for (const m of [0, 15, 30, 45]) {
      if (h === 11 && m > 30) continue
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return slots[Math.floor(Math.random() * slots.length)]
}
