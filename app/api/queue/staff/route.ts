import {
  todaysEntries, getAvgMinutes, setAvgMinutes, patchEntry, getEntry,
  groupsAhead, checkPin, ACTIVE,
} from '@/lib/queue'

export const dynamic = 'force-dynamic'

// PIN can arrive as a header (GET poll) or in the JSON body (POST action).
function pinFrom(req: Request, body?: any): string {
  return req.headers.get('x-queue-pin')
    ?? new URL(req.url).searchParams.get('pin')
    ?? body?.pin
    ?? ''
}

// Staff: live list of everyone still in line + today's settings.
export async function GET(req: Request) {
  if (!checkPin(pinFrom(req))) return Response.json({ ok: false, error: 'bad_pin' }, { status: 401 })
  const all = await todaysEntries()
  const avg = await getAvgMinutes()
  const active = all
    .filter(e => ACTIVE.includes(e.status))
    .map(e => ({ ...e, wait_minutes: e.status === 'waiting' ? groupsAhead(e, all) * avg : 0 }))
  const seatedToday = all.filter(e => e.status === 'arrived').length
  return Response.json({ ok: true, avg_minutes: avg, active, seated_today: seatedToday })
}

// Staff actions: call | arrive | no_show | set_avg.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any))
  if (!checkPin(pinFrom(req, body))) return Response.json({ ok: false, error: 'bad_pin' }, { status: 401 })
  const action = String(body.action ?? '')

  if (action === 'set_avg') {
    const min = Math.max(1, Math.min(600, parseInt(String(body.avg_minutes), 10) || 45))
    await setAvgMinutes(min)
    return Response.json({ ok: true, avg_minutes: min })
  }

  const id = String(body.id ?? '')
  const e = await getEntry(id)
  if (!e) return Response.json({ ok: false, error: 'not_found' }, { status: 404 })

  if (action === 'call') {
    await patchEntry(id, { status: 'called', called_at: new Date().toISOString() })
  } else if (action === 'arrive') {
    const table = String(body.table_number ?? '').trim().slice(0, 20) || null
    await patchEntry(id, { status: 'arrived', table_number: table, seated_at: new Date().toISOString() })
  } else if (action === 'no_show') {
    await patchEntry(id, { status: 'no_show' })
  } else {
    return Response.json({ ok: false, error: 'bad_action' }, { status: 400 })
  }
  return Response.json({ ok: true })
}
