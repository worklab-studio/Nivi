/**
 * Send a WhatsApp message via Unipile API
 * Uses the chat-based messaging endpoint
 */
export async function sendWhatsApp(
  to: string,
  message: string,
  existingChatId?: string
): Promise<void> {
  let chatId = existingChatId

  if (!chatId) {
    const accountId = await getWhatsAppAccountId()
    if (!accountId) {
      console.error('[WA send] No WhatsApp account connected in Unipile')
      return
    }
    console.log('[WA send] finding/creating chat for:', to)
    chatId = await findOrCreateChat(accountId, to) ?? undefined
    if (!chatId) {
      console.error('[WA send] Could not find or create chat for:', to)
      return
    }
  }

  console.log('[WA send] sending to chatId:', chatId, 'msg:', message.slice(0, 50))

  const res = await fetch(
    `${process.env.UNIPILE_BASE_URL}/api/v1/chats/${chatId}/messages`,
    {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: message.trim() }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    console.error('[WA send] error', res.status, err, 'chatId:', chatId, 'to:', to)
  } else {
    console.log('[WA send] success to:', to)
  }
}

let cachedWhatsAppAccountId: string | null = null
const chatIdCache = new Map<string, string>()

async function getWhatsAppAccountId(): Promise<string | null> {
  if (cachedWhatsAppAccountId) return cachedWhatsAppAccountId

  const res = await fetch(
    `${process.env.UNIPILE_BASE_URL}/api/v1/accounts`,
    {
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY!,
        accept: 'application/json',
      },
    }
  )
  const data = await res.json()
  const waAccount = data.items?.find(
    (a: { type?: string; provider?: string }) =>
      a.type === 'WHATSAPP' || a.provider === 'WHATSAPP'
  )
  if (waAccount) {
    cachedWhatsAppAccountId = waAccount.id
  }
  return cachedWhatsAppAccountId
}

async function findOrCreateChat(
  accountId: string,
  phoneNumber: string
): Promise<string | null> {
  // Normalize: strip +, spaces, dashes
  const normalized = phoneNumber.replace(/[\s\-\+\(\)]/g, '')

  // Check cache first
  if (chatIdCache.has(normalized)) {
    return chatIdCache.get(normalized)!
  }

  // Search existing chats
  try {
    const res = await fetch(
      `${process.env.UNIPILE_BASE_URL}/api/v1/chats?account_id=${accountId}&limit=50`,
      {
        headers: {
          'X-API-KEY': process.env.UNIPILE_API_KEY!,
          accept: 'application/json',
        },
      }
    )
    const data = await res.json()
    const chat = data.items?.find(
      (c: { provider_id?: string }) => {
        const pid = (c.provider_id ?? '').replace(/[\+@\s].*/g, '').replace(/^\+/, '')
        return pid === normalized || pid.endsWith(normalized) || normalized.endsWith(pid)
      }
    )

    if (chat) {
      chatIdCache.set(normalized, chat.id)
      return chat.id
    }
  } catch (err) {
    console.error('[WA findChat] search error:', (err as Error).message)
  }

  // Create new chat — send the message directly in chat creation
  // This is more reliable than creating + sending separately
  try {
    const createRes = await fetch(
      `${process.env.UNIPILE_BASE_URL}/api/v1/chats`,
      {
        method: 'POST',
        headers: {
          'X-API-KEY': process.env.UNIPILE_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_id: accountId,
          attendees_ids: [`${normalized}@s.whatsapp.net`],
          text: ' ',
        }),
      }
    )

    if (!createRes.ok) {
      const errText = await createRes.text()
      console.error('[WA createChat] failed:', createRes.status, errText)
      return null
    }

    const newChat = await createRes.json()
    console.log('[WA createChat] result:', JSON.stringify(newChat).slice(0, 300))

    // Unipile may return chat_id or id depending on the endpoint
    const chatId = newChat.chat_id ?? newChat.id ?? null
    if (chatId) {
      chatIdCache.set(normalized, chatId)
      return chatId
    }

    console.error('[WA createChat] no chat ID in response:', JSON.stringify(newChat).slice(0, 300))
    return null
  } catch (err) {
    console.error('[WA createChat] error:', (err as Error).message)
    return null
  }
}
