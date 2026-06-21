import { supabase, supabaseConfigured } from './supabase'

// Server-only. Imports the service_role client — never import into a 'use client' file.

// ---------------- time helpers (Malaysia, UTC+8) ----------------
const MYT = 8 * 60 * 60 * 1000
export function startOfDayMYT(d = new Date()): Date {
  const x = new Date(d.getTime() + MYT); x.setUTCHours(0, 0, 0, 0)
  return new Date(x.getTime() - MYT)
}
export function addDays(d: Date, n: number): Date { return new Date(d.getTime() + n * 864e5) }
const minsSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
export const formatQ = (n: number) => 'Q' + String(n).padStart(3, '0')

// ---------------- settings ----------------
export type Settings = {
  max_capacity: number; target_average_duration: number; cleaning_minutes: number; allow_split_tables: boolean
}
export const DEFAULTS: Settings = {
  max_capacity: 56, target_average_duration: 45, cleaning_minutes: 5, allow_split_tables: true,
}
export async function getSettings(): Promise<Settings> {
  if (!supabaseConfigured) return { ...DEFAULTS }
  const { data } = await supabase.from('app_settings').select('key,value')
  const s: Record<string, unknown> = { ...DEFAULTS }
  for (const row of data ?? []) {
    if (row.key === 'allow_split_tables') s[row.key] = row.value === 'true'
    else if (row.key in DEFAULTS) s[row.key] = Number(row.value)
  }
  return s as unknown as Settings
}
export async function setSetting(key: string, value: string): Promise<void> {
  await supabase.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() })
}

// ---------------- queue open / close ----------------
// Stored as an app_settings row; defaults to OPEN if never set.
export async function getQueueOpen(): Promise<boolean> {
  if (!supabaseConfigured) return true
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'queue_open').maybeSingle()
  return data ? data.value !== 'false' : true
}
export async function setQueueOpen(open: boolean): Promise<void> {
  await supabase.from('app_settings').upsert({ key: 'queue_open', value: open ? 'true' : 'false', updated_at: new Date().toISOString() })
}

// ---------------- tables ----------------
export type TableStatus = 'available' | 'seated' | 'cleaning' | 'disabled'
export type OpsTable = {
  id: string; zone: string; label: string; seats: number; sort: number
  status: TableStatus; status_since: string; active_visit_id: string | null
}
export async function listTables(): Promise<OpsTable[]> {
  if (!supabaseConfigured) return []
  const { data } = await supabase.from('restaurant_tables').select('*').order('sort')
  return (data ?? []) as OpsTable[]
}
async function setTableStatus(ids: string[], status: TableStatus, activeVisitId: string | null) {
  if (!ids.length) return
  await supabase.from('restaurant_tables')
    .update({ status, status_since: new Date().toISOString(), active_visit_id: activeVisitId })
    .in('id', ids)
}
export async function setTableCapacity(id: string, seats: number) {
  await supabase.from('restaurant_tables').update({ seats: Math.max(1, seats) }).eq('id', id)
}

// ---------------- visits (table sessions = the timer) ----------------
export type Visit = {
  id: string; queue_entry_id: string | null; customer_name: string | null; pax_count: number
  seated_at: string; left_at: string | null; duration_minutes: number | null; status: string; notes: string | null
}
export async function activeVisits(): Promise<Visit[]> {
  if (!supabaseConfigured) return []
  const { data } = await supabase.from('visits').select('*').eq('status', 'seated').order('seated_at')
  return (data ?? []) as Visit[]
}
export async function seatedPaxNow(): Promise<number> {
  return (await activeVisits()).reduce((s, v) => s + v.pax_count, 0)
}

// Seat a group on one or more tables. Throws a friendly message on any rule violation.
export async function seatGroup(opts: {
  pax: number; tableIds: string[]; customerName?: string | null; queueEntryId?: string | null
}): Promise<Visit> {
  const settings = await getSettings()
  const pax = Math.max(1, Math.floor(opts.pax))
  const seated = await seatedPaxNow()
  if (seated + pax > settings.max_capacity)
    throw new Error(`Cannot seat this group. Only ${Math.max(0, settings.max_capacity - seated)} seats available.`)

  const tables = await listTables()
  const chosen = tables.filter(t => opts.tableIds.includes(t.id))
  // Friendly pre-checks (the authoritative availability check is the atomic
  // claim below — these just give a nicer message in the common case).
  if (!chosen.length) throw new Error('Pick at least one table.')
  if (chosen.some(t => t.status !== 'available')) throw new Error('One of those tables is no longer available.')
  if (chosen.length > 1 && !settings.allow_split_tables) throw new Error('Splitting across tables is turned off in Settings.')
  const cap = chosen.reduce((s, t) => s + t.seats, 0)
  if (cap < pax) throw new Error(`Those tables seat ${cap}. This group is ${pax} pax.`)

  // ATOMIC guest claim: flip the queue entry waiting -> seated. Only ONE
  // concurrent seating of the same guest can win this (the rest update 0 rows
  // and bail BEFORE occupying any table), so a double-tap or two staff seating
  // the same party can't put one group on multiple tables.
  if (opts.queueEntryId) {
    const { data: claimedEntry } = await supabase.from('queue_entries')
      .update({ status: 'seated', seated_at: new Date().toISOString() })
      .eq('id', opts.queueEntryId).eq('status', 'waiting')
      .select('id')
    if (!claimedEntry || claimedEntry.length === 0)
      throw new Error('That guest has already been seated.')
  }
  // From here on, any failure must release the guest claim (back to 'waiting').
  const releaseGuest = async () => {
    if (opts.queueEntryId)
      await supabase.from('queue_entries').update({ status: 'waiting', seated_at: null }).eq('id', opts.queueEntryId)
  }

  const { data: v, error } = await supabase.from('visits').insert({
    pax_count: pax, customer_name: opts.customerName ?? null, queue_entry_id: opts.queueEntryId ?? null, status: 'seated',
  }).select().single()
  if (error) { await releaseGuest(); throw new Error(error.message) }

  // ATOMIC claim: only flips tables that are STILL 'available'. Postgres row
  // locks guarantee two concurrent seatings can't both win the same table —
  // the loser updates 0 of that row, so claimed.length comes up short and we
  // roll back. This prevents double-booking a table under concurrency.
  const { data: claimed, error: claimErr } = await supabase.from('restaurant_tables')
    .update({ status: 'seated', status_since: new Date().toISOString(), active_visit_id: v.id })
    .in('id', opts.tableIds)
    .eq('status', 'available')
    .select('id')
  if (claimErr || !claimed || claimed.length !== chosen.length) {
    // Someone grabbed one of these tables first — release what we claimed, undo
    // the visit, and hand the guest back to the queue so they can be re-seated.
    await supabase.from('restaurant_tables')
      .update({ status: 'available', active_visit_id: null })
      .eq('active_visit_id', v.id)
    await supabase.from('visits').delete().eq('id', v.id)
    await releaseGuest()
    throw new Error('One of those tables was just taken — please pick another.')
  }

  await supabase.from('visit_tables').insert(claimed.map(t => ({ visit_id: v.id, table_id: t.id })))
  // The queue entry was already flipped to 'seated' atomically above.
  return v as Visit
}

// Table completed — stamps the duration (timer total) and flags the table for cleaning.
export async function customerLeft(visitId: string): Promise<void> {
  const { data: v } = await supabase.from('visits').select('*').eq('id', visitId).maybeSingle()
  if (!v || v.status !== 'seated') return
  const dur = Math.max(0, Math.round((Date.now() - new Date(v.seated_at).getTime()) / 60000))
  await supabase.from('visits').update({
    status: 'completed', left_at: new Date().toISOString(), duration_minutes: dur, updated_at: new Date().toISOString(),
  }).eq('id', visitId)
  const { data: vt } = await supabase.from('visit_tables').select('table_id').eq('visit_id', visitId)
  await setTableStatus((vt ?? []).map(r => r.table_id), 'cleaning', null)
}
export async function markReady(tableId: string) { await setTableStatus([tableId], 'available', null) }
export async function markCleaning(tableId: string) { await setTableStatus([tableId], 'cleaning', null) }

// ---------------- queue ----------------
export type QEntry = {
  id: string; queue_number: number; name: string | null; phone: string | null; party_size: number
  status: string; created_at: string; seated_at: string | null; notes: string | null
}
// Only the WAITING entries — the floor view's queue list. Crucially this filters
// at the DB so a long day's cancelled/no-show/seated rows can't push the result
// past Supabase's 1000-row cap and hide newly-joined guests. (Bug found by the
// 1000+ join stress test: the old "all of today, every status" query truncated
// at 1000 and the newest waiting guests silently disappeared from the floor.)
export async function waitingQueue(): Promise<QEntry[]> {
  if (!supabaseConfigured) return []
  const { data } = await supabase.from('queue_entries').select('*')
    .eq('status', 'waiting')
    .gte('created_at', startOfDayMYT().toISOString())
    .order('queue_number').limit(1000)
  return (data ?? []) as QEntry[]
}
export async function cancelQueue(id: string) {
  await supabase.from('queue_entries').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', id)
}
export async function noShowQueue(id: string) {
  await supabase.from('queue_entries').update({ status: 'no_show', no_show_at: new Date().toISOString() }).eq('id', id)
}

// ---------------- seating suggestions ----------------
function pickCombo(avail: { id: string; label: string; seats: number }[], pax: number): { id: string; label: string; seats: number }[] | null {
  const sorted = [...avail].sort((a, b) => b.seats - a.seats)
  const pick: typeof sorted = []; let total = 0
  for (const t of sorted) { if (total >= pax) break; pick.push(t); total += t.seats }
  return total >= pax ? pick : null
}
function suggestFor(pax: number, avail: { id: string; label: string; seats: number }[], allowSplit: boolean): string {
  const single = avail.filter(t => t.seats >= pax).sort((a, b) => a.seats - b.seats)[0]
  if (single) return single.label
  if (!allowSplit) return 'No single table fits'
  const combo = pickCombo(avail, pax)
  return combo ? combo.map(t => t.label).join(' + ') : 'No table available'
}

// ---------------- floor state (drives the Floor page) ----------------
export async function getFloorState() {
  const settings = await getSettings()
  const [tables, visits, waiting] = await Promise.all([listTables(), activeVisits(), waitingQueue()])

  const visitById = new Map(visits.map(v => [v.id, v]))
  // Queue numbers behind the currently-seated tables (for the Q-number badge).
  // Fetched by id — at most one per occupied table — so it's correct no matter
  // how many total entries exist today.
  const seatIds = [...new Set(visits.map(v => v.queue_entry_id).filter(Boolean))] as string[]
  const seatEntries = seatIds.length
    ? ((await supabase.from('queue_entries').select('id,queue_number').in('id', seatIds)).data ?? [])
    : []
  const qById = new Map<string, { queue_number: number }>(
    [...waiting, ...(seatEntries as { id: string; queue_number: number }[])].map(q => [q.id, { queue_number: q.queue_number }]),
  )
  const floorTables = tables.map(t => {
    let visit: null | { id: string; pax: number; seated_at: string; minutes: number; customer: string | null; queue_number: number | null } = null
    if (t.status === 'seated' && t.active_visit_id) {
      const v = visitById.get(t.active_visit_id)
      if (v) visit = {
        id: v.id, pax: v.pax_count, seated_at: v.seated_at, minutes: minsSince(v.seated_at),
        customer: v.customer_name, queue_number: v.queue_entry_id ? (qById.get(v.queue_entry_id)?.queue_number ?? null) : null,
      }
    }
    return {
      id: t.id, zone: t.zone, label: t.label, seats: t.seats, status: t.status, visit,
      cleaningMin: t.status === 'cleaning' ? minsSince(t.status_since) : null,
    }
  })

  const seated = visits.reduce((s, v) => s + v.pax_count, 0)
  const waitingPax = waiting.reduce((s, q) => s + q.party_size, 0)
  const availableSeats = settings.max_capacity - seated
  const avail = floorTables.filter(t => t.status === 'available').map(t => ({ id: t.id, label: t.label, seats: t.seats }))

  const kpi = {
    seatedPax: seated, maxCapacity: settings.max_capacity, availableSeats,
    waitingGroups: waiting.length, waitingPax,
    tablesSeated: floorTables.filter(t => t.status === 'seated').length,
    tablesCleaning: floorTables.filter(t => t.status === 'cleaning').length,
    tablesAvailable: avail.length,
    targetDuration: settings.target_average_duration,
  }

  const queueList = waiting.map(q => ({
    id: q.id, queue_number: q.queue_number, name: q.name, party_size: q.party_size,
    waitMin: minsSince(q.created_at),
    suggestion: q.party_size > availableSeats ? `Only ${Math.max(0, availableSeats)} seats free` : suggestFor(q.party_size, avail, settings.allow_split_tables),
  }))

  return { settings, tables: floorTables, kpi, queue: queueList, nextAction: computeNextAction(floorTables, waiting, settings, availableSeats) }
}

function computeNextAction(
  tables: { label: string; status: string; cleaningMin: number | null; seats: number; id: string; visit: { minutes: number } | null }[],
  waiting: QEntry[], settings: Settings, availableSeats: number,
): { type: string; text: string } {
  const longClean = tables.filter(t => t.status === 'cleaning' && (t.cleaningMin ?? 0) >= settings.cleaning_minutes)
  if (longClean.length) return { type: 'cleaning', text: `Mark ${longClean[0].label} ready — cleaning ${longClean[0].cleaningMin} min.` }

  if (waiting.length) {
    const g = waiting[0]
    const avail = tables.filter(t => t.status === 'available').map(t => ({ id: t.id, label: t.label, seats: t.seats }))
    if (g.party_size > availableSeats) {
      const smaller = waiting.find(w => w.party_size <= availableSeats)
      if (smaller) return { type: 'seat', text: `Only ${Math.max(0, availableSeats)} seats free — seat ${formatQ(smaller.queue_number)} (${smaller.party_size} pax) next.` }
      return { type: 'wait', text: `${waiting.length} group(s) waiting, only ${Math.max(0, availableSeats)} seats free. Wait for a table to clear.` }
    }
    const single = avail.filter(t => t.seats >= g.party_size).sort((a, b) => a.seats - b.seats)[0]
    if (single) return { type: 'seat', text: `Seat ${formatQ(g.queue_number)} (${g.party_size} pax) at ${single.label}.` }
    const combo = settings.allow_split_tables ? pickCombo(avail, g.party_size) : null
    if (combo) return { type: 'seat', text: `Seat ${formatQ(g.queue_number)} (${g.party_size} pax) — combine ${combo.map(t => t.label).join(' + ')}.` }
    return { type: 'wait', text: `No suitable table for ${formatQ(g.queue_number)} (${g.party_size} pax). Wait for a bigger table.` }
  }

  const over = tables.filter(t => t.visit && t.visit.minutes > settings.target_average_duration)
    .sort((a, b) => (b.visit!.minutes) - (a.visit!.minutes))
  if (over.length) return { type: 'over', text: `${over[0].label} over target dining time: ${over[0].visit!.minutes} min.` }
  return { type: 'ok', text: 'Operations normal.' }
}

// ---------------- simple daily dashboard ----------------
export async function getSimpleDashboard() {
  const from = startOfDayMYT(), to = addDays(from, 1)
  const [qRes, vRes, queueOpen, settings] = await Promise.all([
    supabase.from('queue_entries').select('status,party_size,created_at,seated_at')
      .gte('created_at', from.toISOString()).lt('created_at', to.toISOString()),
    supabase.from('visits').select('status,pax_count,seated_at,duration_minutes')
      .gte('seated_at', from.toISOString()).lt('seated_at', to.toISOString()),
    getQueueOpen(),
    getSettings(),
  ])
  const q = (qRes.data ?? []) as { status: string; party_size: number; created_at: string; seated_at: string | null }[]
  const v = (vRes.data ?? []) as { status: string; pax_count: number; seated_at: string; duration_minutes: number | null }[]
  const avg = (a: number[]) => a.length ? Math.round(a.reduce((s, n) => s + n, 0) / a.length) : 0

  const waits = q.filter(e => e.seated_at).map(e => Math.max(0, Math.round((new Date(e.seated_at!).getTime() - new Date(e.created_at).getTime()) / 60000)))
  const completed = v.filter(x => x.status === 'completed')
  const durs = completed.map(x => x.duration_minutes ?? 0).filter(n => n > 0)

  return {
    queueOpen,
    maxCapacity: settings.max_capacity,
    waitingPax: q.filter(e => e.status === 'waiting').reduce((s, e) => s + e.party_size, 0),
    seatedPax: v.filter(x => x.status === 'seated').reduce((s, x) => s + x.pax_count, 0),
    avgWaitMinutes: avg(waits),
    avgTableMinutes: avg(durs),
    completedToday: completed.length,
    noShowsToday: q.filter(e => e.status === 'no_show').length,
    cancelledToday: q.filter(e => e.status === 'cancelled').length,
  }
}

// ---------------- daily CSV export (queue + table session) ----------------
export async function getDayExport(dayStr: string) {
  if (!supabaseConfigured) return []
  const from = new Date(`${dayStr}T00:00:00+08:00`), to = new Date(from.getTime() + 864e5)
  const [qRes, vRes, tRes] = await Promise.all([
    supabase.from('queue_entries').select('*').gte('created_at', from.toISOString()).lt('created_at', to.toISOString()).order('queue_number'),
    supabase.from('visits').select('*').gte('seated_at', from.toISOString()).lt('seated_at', to.toISOString()),
    supabase.from('restaurant_tables').select('id,label'),
  ])
  const entries = (qRes.data ?? []) as QEntry[]
  const visits = (vRes.data ?? []) as Visit[]
  const labelById = new Map((tRes.data ?? []).map((t: { id: string; label: string }) => [t.id, t.label]))

  const vtByVisit = new Map<string, string[]>()
  const visitIds = visits.map(v => v.id)
  if (visitIds.length) {
    const { data: vt } = await supabase.from('visit_tables').select('visit_id,table_id').in('visit_id', visitIds)
    for (const r of (vt ?? []) as { visit_id: string; table_id: string }[]) {
      const a = vtByVisit.get(r.visit_id) ?? []; a.push(labelById.get(r.table_id) ?? r.table_id); vtByVisit.set(r.visit_id, a)
    }
  }
  const visitByQueue = new Map<string, Visit>()
  for (const v of visits) if (v.queue_entry_id) visitByQueue.set(v.queue_entry_id, v)
  const fmt = (iso: string | null) => iso ? new Date(new Date(iso).getTime() + MYT).toISOString().slice(0, 16).replace('T', ' ') : ''

  return entries.map(e => {
    const v = visitByQueue.get(e.id) ?? null
    const tables = v ? (vtByVisit.get(v.id) ?? []).sort().join('+') : ''
    const waitMin = e.seated_at ? Math.max(0, Math.round((new Date(e.seated_at).getTime() - new Date(e.created_at).getTime()) / 60000)) : ''
    const tableMin = v ? (v.duration_minutes != null ? v.duration_minutes : (v.status === 'seated' ? Math.round((Date.now() - new Date(v.seated_at).getTime()) / 60000) : '')) : ''
    return {
      queue_number: e.queue_number, name: e.name ?? '', phone: e.phone ?? '', pax: e.party_size,
      status: e.status, table: tables, joined_at: fmt(e.created_at), seated_at: fmt(e.seated_at),
      completed_at: v && v.left_at ? fmt(v.left_at) : '', wait_minutes: waitMin, table_minutes: tableMin,
    }
  })
}
export const EXPORT_COLUMNS = ['queue_number', 'name', 'phone', 'pax', 'status', 'table', 'joined_at', 'seated_at', 'completed_at', 'wait_minutes', 'table_minutes']
