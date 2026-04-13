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
      console.error('No WhatsApp account connected in Unipile')
      return
    }
    chatId = await findOrCreateChat(accountId, to) ?? undefined
    if (!chatId) {
      console.error('Could not find or create chat for:', to)
      return
    }
  }

  // Send as single message — the personality prompt handles keeping it short
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
    console.error('[WhatsApp Send Error]', res.status, err)
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
  // Check cache first
  if (chatIdCache.has(phoneNumber)) {
    return chatIdCache.get(phoneNumber)!
  }

  // Search existing chats
  const res = await fetch(
    `${process.env.UNIPILE_BASE_URL}/api/v1/chats?account_id=${accountId}`,
    {
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY!,
        accept: 'application/json',
      },
    }
  )
  const data = await res.json()
  const chat = data.items?.find(
    (c: { provider_id?: string }) =>
      c.provider_id?.startsWith(phoneNumber)
  )

  if (chat) {
    chatIdCache.set(phoneNumber, chat.id)
    return chat.id
  }

  // Create new chat
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
        attendees_ids: [`${phoneNumber}@s.whatsapp.net`],
        text: ' ',
      }),
    }
  )
  const newChat = await createRes.json()
  if (newChat.id) {
    chatIdCache.set(phoneNumber, newChat.id)
    return newChat.id
  }

  return null
}
