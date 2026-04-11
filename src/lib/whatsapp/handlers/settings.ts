import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'

/**
 * WhatsApp settings command handler — exact-match commands routed from
 * /api/webhooks/whatsapp/route.ts. Lets users toggle Tier 2 LinkedIn
 * safety settings without needing the dashboard UI.
 *
 * Supported commands (all uppercase, exact match):
 *   I AGREE                — give automation consent
 *   ENABLE DMS             — opt in to LinkedIn DM sending
 *   DISABLE DMS            — opt out
 *   ENABLE CONNECTIONS     — opt in to LinkedIn connection request automation
 *   DISABLE CONNECTIONS    — opt out
 *   MODE SAFE              — switch to safe mode (lowest caps)
 *   MODE STANDARD          — switch to standard mode (default warm)
 *   MODE POWER             — switch to power mode (gated, requires criteria)
 */
export async function handleSettingsCommand(
  userId: string,
  user: { whatsapp_number: string },
  cmd: string
): Promise<Response> {
  const supabase = getSupabaseAdmin()

  switch (cmd) {
    case 'I AGREE': {
      await supabase
        .from('users')
        .update({
          linkedin_automation_consent: true,
          linkedin_automation_consent_at: new Date().toISOString(),
        })
        .eq('id', userId)
      await sendWhatsApp(
        user.whatsapp_number,
        `noted ✅ youre good to go. ill be careful with your linkedin — slow + steady so we dont trigger any flags. you can change settings anytime: reply MODE SAFE / MODE STANDARD, or ENABLE DMS / ENABLE CONNECTIONS to turn on the riskier features.`
      )
      return Response.json({ ok: true })
    }

    case 'ENABLE DMS': {
      await supabase
        .from('users')
        .update({ linkedin_dms_enabled: true })
        .eq('id', userId)
      await sendWhatsApp(
        user.whatsapp_number,
        `linkedin DMs enabled ✅ ill keep them rare — max 5/day. reply DISABLE DMS anytime to turn them off.`
      )
      return Response.json({ ok: true })
    }

    case 'DISABLE DMS': {
      await supabase
        .from('users')
        .update({ linkedin_dms_enabled: false })
        .eq('id', userId)
      await sendWhatsApp(
        user.whatsapp_number,
        `DMs off. wont send any from your account.`
      )
      return Response.json({ ok: true })
    }

    case 'ENABLE CONNECTIONS': {
      await supabase
        .from('users')
        .update({ linkedin_connections_enabled: true })
        .eq('id', userId)
      await sendWhatsApp(
        user.whatsapp_number,
        `connection requests enabled ✅ ill keep them rare — max 15/day. reply DISABLE CONNECTIONS anytime.`
      )
      return Response.json({ ok: true })
    }

    case 'DISABLE CONNECTIONS': {
      await supabase
        .from('users')
        .update({ linkedin_connections_enabled: false })
        .eq('id', userId)
      await sendWhatsApp(user.whatsapp_number, `connection requests off.`)
      return Response.json({ ok: true })
    }

    case 'MODE SAFE': {
      await supabase
        .from('users')
        .update({
          linkedin_mode: 'safe',
          // user manually chose, dont auto-promote them away
          linkedin_mode_locked: true,
        })
        .eq('id', userId)
      await sendWhatsApp(
        user.whatsapp_number,
        `switched to safe mode. lower daily caps, max safety. reply MODE STANDARD to go back.`
      )
      return Response.json({ ok: true })
    }

    case 'MODE STANDARD': {
      await supabase
        .from('users')
        .update({ linkedin_mode: 'standard', linkedin_mode_locked: false })
        .eq('id', userId)
      await sendWhatsApp(
        user.whatsapp_number,
        `switched to standard mode. normal daily caps.`
      )
      return Response.json({ ok: true })
    }

    case 'MODE POWER': {
      const { data: u } = await supabase
        .from('users')
        .select('linkedin_mode, linkedin_connected_at')
        .eq('id', userId)
        .single()

      if (u?.linkedin_mode !== 'standard') {
        await sendWhatsApp(
          user.whatsapp_number,
          `you need to be on standard mode for at least 30 days before enabling power mode. reply MODE STANDARD first if youre not already.`
        )
        return Response.json({ ok: true })
      }

      const sixtyDaysMs = 60 * 86400000
      const connectedAt = u?.linkedin_connected_at
        ? new Date(u.linkedin_connected_at).getTime()
        : 0
      if (!connectedAt || Date.now() - connectedAt < sixtyDaysMs) {
        await sendWhatsApp(
          user.whatsapp_number,
          `power mode is only available after your linkedin account has been connected for 60+ days. protects you from getting flagged early.`
        )
        return Response.json({ ok: true })
      }

      await supabase
        .from('users')
        .update({ linkedin_mode: 'power', linkedin_mode_locked: true })
        .eq('id', userId)
      await sendWhatsApp(
        user.whatsapp_number,
        `power mode enabled ⚡ slightly higher caps. reply MODE STANDARD anytime to dial it back. note: linkedin watches power users closer, so if you start seeing weird stuff happen on your account, drop back to standard immediately.`
      )
      return Response.json({ ok: true })
    }
  }

  return Response.json({ ok: true })
}
