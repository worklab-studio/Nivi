import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { handlePost } from '@/lib/whatsapp/handlers/post'
import { handleSchedule } from '@/lib/whatsapp/handlers/schedule'
import { handleEdit } from '@/lib/whatsapp/handlers/edit'
import { handleSkip } from '@/lib/whatsapp/handlers/skip'
import { handleCancel } from '@/lib/whatsapp/handlers/cancel'
import { handleCommentApproval } from '@/lib/whatsapp/handlers/comments'
import { handleReplyApproval } from '@/lib/whatsapp/handlers/replies'
import { handleConversation } from '@/lib/whatsapp/handlers/conversation'
import { handleOptIn } from '@/lib/whatsapp/handlers/optIn'
import { handleVoiceNote } from '@/lib/whatsapp/handlers/voiceNote'
import { handleImage } from '@/lib/whatsapp/handlers/image'

// Sonnet conversation calls + tool loop can run >60s in production. The
// poll-whatsapp cron uses 300s for the same reason; keep them aligned so
// the webhook isn't silently killed mid-reply.
export const maxDuration = 300

// In-memory dedupe cache for webhook message IDs
const seenMessageIds = new Set<string>()

export async function POST(req: Request) {
  // Parse body — Unipile sends form-urlencoded but body is JSON
  let body: Record<string, unknown>
  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    body = await req.json()
  } else {
    const rawText = await req.text()
    try {
      body = JSON.parse(rawText)
    } catch {
      try {
        body = JSON.parse(decodeURIComponent(rawText))
      } catch {
        return Response.json({ ok: true })
      }
    }
  }

  // Skip our own messages
  if (body.is_sender === true || body.is_sender === 'true') {
    return Response.json({ ok: true })
  }

  // Parse sender
  const senderObj = body.sender as Record<string, unknown> | undefined
  const senderPublicId = (senderObj?.attendee_public_identifier as string) ?? ''
  const senderSpecifics = senderObj?.attendee_specifics as Record<string, unknown> | undefined
  const senderPhone = (senderSpecifics?.phone_number as string) ?? ''
  const from = (senderPhone || senderPublicId).replace(/^\+/, '').replace(/@.*$/, '')

  // Parse message
  const messageRaw = body.message
  const text = typeof messageRaw === 'string'
    ? messageRaw
    : ((messageRaw as Record<string, unknown>)?.text as string) ?? ''
  const chatId = (body.chat_id as string) ?? ''
  const isForwarded = body.is_forwarded === true || body.is_forwarded === 'true'
  const messageType = (body.message_type as string) ?? (body.type as string) ?? 'text'

  // Unipile sends attachments in different locations depending on version.
  // Check body.attachments, body.media, and body.message.attachments.
  let attachments = (body.attachments as Array<Record<string, unknown>>) ?? []
  if (attachments.length === 0 && body.media) {
    attachments = Array.isArray(body.media) ? body.media : [body.media as Record<string, unknown>]
  }
  if (attachments.length === 0 && typeof messageRaw === 'object' && messageRaw !== null) {
    const msgObj = messageRaw as Record<string, unknown>
    if (msgObj.attachments) {
      attachments = Array.isArray(msgObj.attachments) ? msgObj.attachments : [msgObj.attachments as Record<string, unknown>]
    } else if (msgObj.media) {
      attachments = Array.isArray(msgObj.media) ? msgObj.media : [msgObj.media as Record<string, unknown>]
    }
    // Some Unipile formats put the media URL directly on message
    if (attachments.length === 0 && (msgObj.media_url || msgObj.image_url || msgObj.document_url)) {
      attachments = [{
        id: (msgObj.media_id as string) ?? '',
        type: messageType,
        mime_type: (msgObj.mime_type as string) ?? '',
        filename: (msgObj.filename as string) ?? '',
        url: (msgObj.media_url ?? msgObj.image_url ?? msgObj.document_url) as string,
      }]
    }
  }

  console.log('[WA in]', from, ':', text.slice(0, 80), isForwarded ? '[FORWARDED]' : '', 'type:', messageType, 'attachments:', attachments.length, attachments.length > 0 ? JSON.stringify(attachments[0]).slice(0, 300) : '')
  // Log the FULL webhook body for media debugging (one-time — remove after fixing)
  if (attachments.length > 0) {
    console.log('[WA FULL BODY]', JSON.stringify(body).slice(0, 2000))
  }

  if (!from) return Response.json({ ok: true })

  // Dedupe by message_id — Unipile can send the same webhook twice
  const messageId = (body.message_id as string) ?? ''
  if (messageId) {
    if (seenMessageIds.has(messageId)) {
      console.log('[WA dedupe] skipping duplicate', messageId)
      return Response.json({ ok: true, deduped: true })
    }
    seenMessageIds.add(messageId)
    // Clean old entries to prevent memory leak
    if (seenMessageIds.size > 500) {
      const arr = Array.from(seenMessageIds)
      seenMessageIds.clear()
      arr.slice(-200).forEach(id => seenMessageIds.add(id))
    }
  }

  // Look up user. Try exact whatsapp_number first, then suffix-match on the
  // last 10 digits — some users connect a number formatted slightly
  // differently than what WhatsApp's webhook reports (missing country code,
  // extra leading zero, etc.) and we'd otherwise treat them as a new user
  // forever.
  const supabase = getSupabaseAdmin()
  const fromDigits = from.replace(/\D/g, '')
  const fromSuffix = fromDigits.slice(-10)
  let { data: user } = await supabase
    .from('users')
    .select('id, name, whatsapp_number, plan, timezone, niche, streak_count, onboarding_complete')
    .eq('whatsapp_number', from)
    .maybeSingle()

  if (!user && fromSuffix.length === 10) {
    const { data: suffixMatch } = await supabase
      .from('users')
      .select('id, name, whatsapp_number, plan, timezone, niche, streak_count, onboarding_complete')
      .like('whatsapp_number', `%${fromSuffix}`)
      .limit(1)
      .maybeSingle()
    if (suffixMatch) {
      user = suffixMatch
      // Normalize the stored number to what WhatsApp actually sends, so
      // future lookups hit the exact-match fast path.
      if (suffixMatch.whatsapp_number !== from) {
        console.log('[WA lookup] normalizing stored whatsapp_number', suffixMatch.whatsapp_number, '→', from)
        supabase
          .from('users')
          .update({ whatsapp_number: from })
          .eq('id', suffixMatch.id)
          .then(() => {}, () => {})
      }
    }
  }

  if (!user) {
    const trimmed = text.trim()
    const upperText = trimmed.toUpperCase()

    // Legacy path: explicit opt-in code ("START ABC123")
    if (upperText.startsWith('START ')) {
      handleOptIn(from, trimmed.replace(/^START\s+/i, '').trim()).catch(() => {})
      return Response.json({ ok: true })
    }

    // Phone verification flow: user entered their number in onboarding or
    // Settings, Nivi sent them a message. We set `pending_whatsapp` to the
    // number they typed. Any reply from that number confirms the link —
    // don't gate on specific keywords (users write "ok!", "yes please",
    // "sure thing", "👍", Hindi greetings, etc.). Match strict-eq first,
    // then suffix-match.
    let pendingUser:
      | { id: string; name: string | null; onboarding_complete: boolean | null }
      | null = null
    {
      const { data } = await supabase
        .from('users')
        .select('id, name, onboarding_complete')
        .eq('pending_whatsapp', from)
        .maybeSingle()
      pendingUser = data
    }
    if (!pendingUser && fromSuffix.length === 10) {
      const { data } = await supabase
        .from('users')
        .select('id, name, onboarding_complete')
        .like('pending_whatsapp', `%${fromSuffix}`)
        .limit(1)
        .maybeSingle()
      pendingUser = data
    }

    if (pendingUser) {
      await supabase
        .from('users')
        .update({ whatsapp_number: from, pending_whatsapp: null })
        .eq('id', pendingUser.id)

      const greeting = pendingUser.onboarding_complete
        ? `welcome back ${pendingUser.name ?? ''}, whatsapp reconnected. your morning brief hits at your usual time.`
        : `hey ${pendingUser.name ?? ''}! whatsapp is linked. head back to hellonivi.com to finish setting me up.`

      sendWhatsApp(from, greeting.trim(), chatId).catch(() => {})
      console.log('[WA opt-in] linked user', pendingUser.id, 'from', from)
      return Response.json({ ok: true })
    }

    console.log('[WA unknown] no user or pending match for', from, 'msg:', text.slice(0, 80))
    return Response.json({ ok: true })
  }

  // Gate WhatsApp behind 'complete' plan (with 7-day trial grace)
  // Sends a single upgrade prompt (rate-limited to 24h) and returns early.
  const { sendUpgradePromptIfNeeded } = await import('@/lib/whatsapp/upgradePrompt')
  const { allowed } = await sendUpgradePromptIfNeeded(
    { id: user.id, name: user.name, whatsapp_number: from },
    chatId
  )
  if (!allowed) {
    return Response.json({ ok: true })
  }

  // Process synchronously — Vercel kills async work after response
  try {
    await processMessage(user, chatId, text, isForwarded, messageType, attachments, messageId)
  } catch (err) {
    console.error('[WA error]', (err as Error)?.message ?? err)
  }

  return Response.json({ ok: true })
}

async function processMessage(
  user: { id: string; name: string; whatsapp_number: string; plan: string; timezone: string; niche: string | null; streak_count: number; onboarding_complete: boolean },
  chatId: string,
  text: string,
  isForwarded: boolean,
  messageType: string,
  attachments: Array<Record<string, unknown>>,
  webhookMessageId: string
) {
  const userId = user.id
  const cmd = text.trim().toUpperCase()
  const rawText = text.trim()

  // Handle voice notes
  if (
    messageType === 'audio' ||
    attachments.some(
      (a) =>
        (a.type as string)?.includes('audio') ||
        (a.attachment_type as string)?.includes('audio') ||
        (a.mime_type as string)?.includes('audio')
    )
  ) {
    const audioId =
      (attachments[0]?.attachment_id as string) ??
      (attachments[0]?.id as string) ??
      ''
    if (audioId) {
      await handleVoiceNote(userId, audioId, webhookMessageId, chatId)
      return
    }
  }

  // Handle any media: images, PDFs, docs, spreadsheets
  // Priority: if attachments exist, always process them as media regardless of
  // what messageType says — Unipile sometimes sets messageType to 'text' or ''
  // even for image/pdf messages.
  if (attachments.length > 0) {
    const { handleMedia } = await import('@/lib/whatsapp/handlers/media')
    const att = attachments[0]
    // Unipile uses attachment_id / attachment_type / attachment_name — normalize
    const mediaId =
      (att.attachment_id as string) ??
      (att.id as string) ??
      (att.media_id as string) ??
      ''
    const mediaType =
      (att.attachment_type as string) ??
      (att.type as string) ??
      messageType
    const mediaFilename =
      (att.attachment_name as string) ??
      (att.filename as string) ??
      (att.name as string) ??
      ''
    const mediaMime =
      (att.mime_type as string) ??
      (att.content_type as string) ??
      ''
    console.log('[WA media]', 'id:', mediaId, 'type:', mediaType, 'file:', mediaFilename, 'mime:', mediaMime, 'msgId:', webhookMessageId)
    await handleMedia(
      userId,
      { ...user, chatId },
      {
        id: mediaId,
        type: mediaType,
        mimeType: mediaMime,
        filename: mediaFilename,
        messageId: webhookMessageId,
      },
      rawText
    )
    return
  }

  // Handle URLs in message text — fetch and feed to Nivi
  const urlMatch = rawText.match(/https?:\/\/[^\s]+/)
  if (urlMatch) {
    const { handleUrlInMessage } = await import('@/lib/whatsapp/handlers/media')
    await handleUrlInMessage(userId, { ...user, chatId }, rawText, urlMatch[0])
    return
  }

  // Handle forwarded messages → SWIPE FILE
  // User forwards a LinkedIn post or any content → Nivi rewrites in their voice
  if (isForwarded && rawText.length > 30) {
    await handleConversation(
      userId,
      { ...user, chatId },
      `[FORWARDED MESSAGE — user wants you to rewrite this in their voice or react to it]\n\n${rawText}`
    )
    return
  }

  // Tier 2 LinkedIn safety commands — exact match, fast path
  if (
    cmd === 'I AGREE' ||
    cmd === 'ENABLE DMS' ||
    cmd === 'DISABLE DMS' ||
    cmd === 'ENABLE CONNECTIONS' ||
    cmd === 'DISABLE CONNECTIONS' ||
    cmd === 'MODE SAFE' ||
    cmd === 'MODE STANDARD' ||
    cmd === 'MODE POWER'
  ) {
    const { handleSettingsCommand } = await import('@/lib/whatsapp/handlers/settings')
    await handleSettingsCommand(userId, user, cmd)
    return
  }

  // Exact commands (fast path — no Claude needed)
  if (cmd === 'POST') { await handlePost(userId, { ...user, chatId }); return }
  if (cmd === 'SKIP') { await handleSkip(userId, user); return }
  if (cmd === 'CANCEL') { await handleCancel(userId, user); return }
  if (cmd === 'ALL') { await handleCommentApproval(userId, user, 'ALL'); return }
  if (cmd === 'STOP') {
    const supabase = getSupabaseAdmin()
    await supabase.from('users').update({ whatsapp_number: null }).eq('id', userId)
    await sendWhatsApp(user.whatsapp_number, "unsubscribed. reconnect anytime at hellonivi.com", chatId)
    return
  }

  // Pattern commands
  if (/^SCHEDULE\s+.+/i.test(rawText)) { await handleSchedule(userId, user, rawText); return }
  if (/^EDIT:\s*.+/i.test(rawText)) { await handleEdit(userId, { ...user, chatId }, rawText); return }
  if (/^(C[1-5]\s*)+$/i.test(cmd)) { await handleCommentApproval(userId, user, cmd); return }
  if (/^R[1-5]$/i.test(cmd)) { await handleReplyApproval(userId, { ...user, chatId }, cmd); return }

  // Everything else → Nivi conversation (handles braindumps, questions, chat, post requests)
  await handleConversation(userId, { ...user, chatId }, rawText)
}
