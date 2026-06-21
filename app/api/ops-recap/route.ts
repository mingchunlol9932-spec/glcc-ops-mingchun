import { sendMessage } from '@/lib/telegram'
import { getRecords, rm, DEAL_CATS } from '@/lib/records'
import { supabase, supabaseConfigured } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// A Vercel Cron hits this at 08:00 Malaysia time (UTC+8 → "0 0 * * *" in UTC)
// and texts the owner a recap of everything that came in YESTERDAY. Guarded by
// CRON_SECRET (Bearer) exactly like /api/digest, so only Vercel can trigger it.
//
// The records table only has created_at (no status history), so we report what
// is provable from the data: things CREATED yesterday — not status changes.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  // TEMP diagnostic — reports only whether the runtime sees CRON_SECRET, never its value.
  const u = new URL(req.url)
  if (u.searchParams.get('diag') === '1') {
    return Response.json({ hasSecret: Boolean(secret), secretLen: (secret ?? '').length })
  }
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('forbidden', { status: 401 })
  }

  // "Yesterday" on the Malaysia clock (UTC+8), expressed as a UTC window — same
  // local-midnight convention the queue uses (see lib/queue.ts startOfTodayMYT).
  const off = 8 * 60 * 60 * 1000
  const todayMyt = new Date(Date.now() + off)
  todayMyt.setUTCHours(0, 0, 0, 0)
  const todayStartUTC = new Date(todayMyt.getTime() - off)        // 00:00 MYT today
  const yStartUTC = new Date(todayStartUTC.getTime() - 864e5)     // 00:00 MYT yesterday
  const startISO = yStartUTC.toISOString()
  const endISO = todayStartUTC.toISOString()
  const label = new Date(yStartUTC.getTime() + off).toLocaleDateString('en-MY', {
    weekday: 'short', day: '2-digit', month: 'short',
  })

  // Records created yesterday — count, category breakdown, new pipeline value.
  const recs = (await getRecords()).filter(r => r.created_at >= startISO && r.created_at < endISO)
  const byCat = recs.reduce<Record<string, number>>((a, r) => {
    const k = r.category || 'uncategorized'
    a[k] = (a[k] || 0) + 1
    return a
  }, {})
  const catStr = Object.entries(byCat).map(([k, n]) => `${n} ${k}`).join(' · ')
  const newPipeline = recs
    .filter(r => r.category && DEAL_CATS.includes(r.category))
    .reduce((s, r) => s + Number(r.amount || 0), 0)

  // Queue entries created yesterday — joins / seated / no-shows / cancelled.
  let qJoined = 0, qSeated = 0, qNoShow = 0, qCancelled = 0
  if (supabaseConfigured) {
    const { data } = await supabase
      .from('queue_entries')
      .select('status')
      .gte('created_at', startISO)
      .lt('created_at', endISO)
    for (const e of data ?? []) {
      qJoined++
      if (e.status === 'arrived') qSeated++
      else if (e.status === 'no_show') qNoShow++
      else if (e.status === 'cancelled') qCancelled++
    }
  }

  const quiet = recs.length === 0 && qJoined === 0
  const msg = quiet
    ? `☀️ <b>Ops recap — ${label}</b>\nQuiet day — nothing new.`
    : (
        `☀️ <b>Ops recap — ${label}</b>\n` +
        (recs.length ? `➕ Records added: <b>${recs.length}</b>` + (catStr ? `  (${catStr})` : '') + `\n` : '') +
        (newPipeline ? `💰 New pipeline value: <b>${rm(newPipeline)}</b>\n` : '') +
        (qJoined ? `🚶 Queue: ${qJoined} joined · ${qSeated} seated · ${qNoShow} no-shows · ${qCancelled} cancelled` : '')
      ).trim()

  const owner = process.env.OWNER_CHAT_ID?.trim()
  if (owner) await sendMessage(owner, msg)
  return Response.json({ ok: true, sent: !!owner, day: label, records: recs.length, queue: qJoined })
}
