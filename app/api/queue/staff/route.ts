import {
  todaysEntries, getAvgMinutes, setAvgMinutes, patchEntry, getEntry,
  groupsAhead, checkPin, ACTIVE,
  listTables, getTable, occupyTable, freeTable, freeTablesByEntry,
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

  // Floor: each table plus who's seated there (name resolved from today's entries).
  const tables = await listTables()
  const nameById = new Map(all.map(e => [e.id, e.name]))
  const floor = tables.map(t => ({
    id: t.id, zone: t.zone, label: t.label, seats: t.seats,
    occupied: !!t.occupied_by,
    occupant: t.occupied_by ? (nameById.get(t.occupied_by) ?? 'Seated') : null,
  }))
  const freeTables = floor.filter(t => !t.occupied).length

  return Response.json({ ok: true, avg_minutes: avg, active, seated_today: seatedToday, floor, free_tables: freeTables })
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

  // Free a table — releases the whole combined group it belongs to.
  if (action === 'free_table') {
    const tableId = String(body.table_id ?? '')
    const t = tableId ? await getTable(tableId) : null
    if (t?.occupied_by) await freeTablesByEntry(t.occupied_by)
    else if (tableId) await freeTable(tableId)
    return Response.json({ ok: true })
  }

  const id = String(body.id ?? '')
  const e = await getEntry(id)
  if (!e) return Response.json({ ok: false, error: 'not_found' }, { status: 404 })

  if (action === 'call') {
    await patchEntry(id, { status: 'called', called_at: new Date().toISOString() })
  } else if (action === 'arrive') {
    // Seat at one or more tables (combine). Mark each occupied; stamp combined label.
    const ids: string[] = Array.isArray(body.table_ids)
      ? body.table_ids.map((x: unknown) => String(x))
      : (body.table_id ? [String(body.table_id)] : [])
    const tables = []
    for (const tid of ids) { const t = await getTable(tid); if (t) tables.push(t) }
    const label = tables.length
      ? tables.map(t => t.label).join('+')
      : (String(body.table_number ?? '').trim().slice(0, 40) || null)
    await patchEntry(id, { status: 'arrived', table_number: label, seated_at: new Date().toISOString() })
    for (const t of tables) await occupyTable(t.id, id)
  } else if (action === 'no_show') {
    await patchEntry(id, { status: 'no_show' })
  } else {
    return Response.json({ ok: false, error: 'bad_action' }, { status: 400 })
  }
  return Response.json({ ok: true })
}
