import { supabase, supabaseConfigured } from './supabase'

// Server-only. Imports the service_role client — never import into a 'use client' file.

// ---------------- time helpers (Malaysia, UTC+8) ----------------
const MYT = 8 * 60 * 60 * 1000
export function startOfDayMYT(d = new Date()): Date {
  const x = new Date(d.getTime() + MYT); x.setUTCHours(0, 0, 0, 0)
  return new Date(x.getTime() - MYT)
}
export function addDays(d: Date, n: number): Date { return new Date(d.getTime() + n * 864e5) }
function mytHour(iso: string): number { return new Date(new Date(iso).getTime() + MYT).getUTCHours() }
function mytDayKey(iso: string): string { return new Date(new Date(iso).getTime() + MYT).toISOString().slice(0, 10) }
const minsSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
export const formatQ = (n: number) => 'Q' + String(n).padStart(3, '0')

// ---------------- settings ----------------
export type Settings = {
  max_capacity: number; target_average_duration: number; cleaning_minutes: number
  allow_split_tables: boolean; good_day_target_pax: number; target_utilization: number
  peak_utilization_target: number; lost_pax_good_threshold: number; lost_pax_bad_threshold: number
  no_show_good_threshold: number; open_hour: number; close_hour: number
}
export const DEFAULTS: Settings = {
  max_capacity: 56, target_average_duration: 45, cleaning_minutes: 5, allow_split_tables: true,
  good_day_target_pax: 180, target_utilization: 70, peak_utilization_target: 85,
  lost_pax_good_threshold: 10, lost_pax_bad_threshold: 30, no_show_good_threshold: 5,
  open_hour: 10, close_hour: 22,
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

// ---------------- visits ----------------
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
  if (!chosen.length) throw new Error('Pick at least one table.')
  if (chosen.some(t => t.status !== 'available')) throw new Error('One of those tables is no longer available.')
  if (chosen.length > 1 && !settings.allow_split_tables) throw new Error('Splitting across tables is turned off in Settings.')
  const cap = chosen.reduce((s, t) => s + t.seats, 0)
  if (cap < pax) throw new Error(`Those tables seat ${cap}. This group is ${pax} pax.`)

  const { data: v, error } = await supabase.from('visits').insert({
    pax_count: pax, customer_name: opts.customerName ?? null, queue_entry_id: opts.queueEntryId ?? null, status: 'seated',
  }).select().single()
  if (error) throw new Error(error.message)
  await supabase.from('visit_tables').insert(chosen.map(t => ({ visit_id: v.id, table_id: t.id })))
  await setTableStatus(chosen.map(t => t.id), 'seated', v.id)
  if (opts.queueEntryId)
    await supabase.from('queue_entries').update({ status: 'seated', seated_at: new Date().toISOString() }).eq('id', opts.queueEntryId)
  return v as Visit
}

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
export async function todaysQueue(): Promise<QEntry[]> {
  if (!supabaseConfigured) return []
  const { data } = await supabase.from('queue_entries').select('*')
    .gte('created_at', startOfDayMYT().toISOString()).order('queue_number')
  return (data ?? []) as QEntry[]
}
export async function addQueueEntry(name: string | null, pax: number, phone: string | null, notes: string | null) {
  const today = await todaysQueue()
  const next = today.reduce((m, e) => Math.max(m, e.queue_number), 0) + 1
  // queue_entries.name is NOT NULL — default anonymous walk-ins to "Walk-up".
  const { data, error } = await supabase.from('queue_entries').insert({
    name: name && name.trim() ? name.trim() : 'Walk-up',
    party_size: Math.max(1, Math.floor(pax)), phone, notes, status: 'waiting', queue_number: next,
  }).select().single()
  if (error) throw new Error(error.message)
  return data
}
export async function cancelQueue(id: string) {
  await supabase.from('queue_entries').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', id)
}
export async function noShowQueue(id: string) {
  await supabase.from('queue_entries').update({ status: 'no_show', no_show_at: new Date().toISOString() }).eq('id', id)
}
export async function lostCustomer(queueId: string | null, pax: number, reason: string, note: string | null) {
  if (queueId) await supabase.from('queue_entries').update({ status: 'lost', lost_at: new Date().toISOString() }).eq('id', queueId)
  await supabase.from('lost_customers').insert({ queue_entry_id: queueId, pax_count: Math.max(1, Math.floor(pax)), reason, note })
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
  const [tables, visits, queue] = await Promise.all([listTables(), activeVisits(), todaysQueue()])
  const { data: completedToday } = await supabase.from('visits')
    .select('pax_count').eq('status', 'completed').gte('seated_at', startOfDayMYT().toISOString())

  const visitById = new Map(visits.map(v => [v.id, v]))
  const qById = new Map(queue.map(q => [q.id, q]))
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
  const waiting = queue.filter(q => q.status === 'waiting')
  const waitingPax = waiting.reduce((s, q) => s + q.party_size, 0)
  const availableSeats = settings.max_capacity - seated
  const avail = floorTables.filter(t => t.status === 'available').map(t => ({ id: t.id, label: t.label, seats: t.seats }))

  const kpi = {
    seatedPax: seated, maxCapacity: settings.max_capacity, availableSeats,
    waitingGroups: waiting.length, waitingPax,
    servedPax: (completedToday ?? []).reduce((s, v) => s + v.pax_count, 0),
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

// ---------------- metrics over a date range ----------------
type Raw = {
  visits: Visit[]; queue: QEntry[]; lost: { pax_count: number; reason: string | null; created_at: string }[]
  visitTables: { visit_id: string; table_id: string }[]
}
async function rangeData(from: Date, to: Date): Promise<Raw> {
  const [v, q, l] = await Promise.all([
    supabase.from('visits').select('*').gte('seated_at', from.toISOString()).lt('seated_at', to.toISOString()),
    supabase.from('queue_entries').select('*').gte('created_at', from.toISOString()).lt('created_at', to.toISOString()),
    supabase.from('lost_customers').select('pax_count,reason,created_at').gte('created_at', from.toISOString()).lt('created_at', to.toISOString()),
  ])
  const visits = (v.data ?? []) as Visit[]
  const ids = visits.map(x => x.id)
  let visitTables: { visit_id: string; table_id: string }[] = []
  if (ids.length) {
    const vt = await supabase.from('visit_tables').select('visit_id,table_id').in('visit_id', ids)
    visitTables = vt.data ?? []
  }
  return { visits, queue: (q.data ?? []) as QEntry[], lost: l.data ?? [], visitTables }
}
const mean = (a: number[]) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0
const median = (a: number[]) => {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
function operatingMinutes(from: Date, to: Date, s: Settings): number {
  const win = Math.max(1, s.close_hour - s.open_hour) * 60
  let total = 0
  for (let d = startOfDayMYT(from); d < to; d = addDays(d, 1)) {
    const open = new Date(d.getTime() + s.open_hour * 3600e3)
    const close = new Date(d.getTime() + s.close_hour * 3600e3)
    const end = Math.min(close.getTime(), Date.now())
    total += Math.max(0, Math.min(end, close.getTime()) - open.getTime()) / 60000
  }
  return total || win
}

export type Metrics = {
  paxServed: number; groupsServed: number; avgDuration: number; medianDuration: number
  fastestTurn: number | null; slowestTurn: number | null; turnoverCount: number; avgPaxPerGroup: number
  seatUtilization: number; peakHour: string; lostPax: number; noShows: number; cancellations: number
  noShowRate: number; cancelRate: number; queueConversion: number; lostByReason: Record<string, number>
  paxByHour: { hour: number; pax: number }[]; peakHourUtilization: number
}
function metricsFrom(raw: Raw, s: Settings, from: Date, to: Date, activeSeatMin = 0): Metrics {
  const completed = raw.visits.filter(v => v.status === 'completed')
  const durations = completed.map(v => v.duration_minutes ?? 0).filter(n => n > 0)
  const paxServed = completed.reduce((sm, v) => sm + v.pax_count, 0)
  const groupsServed = completed.length

  // pax demand by hour (from all seated visits in range)
  const byHour = new Map<number, number>()
  for (const v of raw.visits) byHour.set(mytHour(v.seated_at), (byHour.get(mytHour(v.seated_at)) ?? 0) + v.pax_count)
  const paxByHour = Array.from(byHour.entries()).map(([hour, pax]) => ({ hour, pax })).sort((a, b) => a.hour - b.hour)
  const peak = paxByHour.slice().sort((a, b) => b.pax - a.pax)[0]
  const peakHour = peak ? `${String(peak.hour).padStart(2, '0')}:00` : '—'

  // seat utilization = occupied seat-minutes / (capacity * operating minutes)
  const occSeatMin = completed.reduce((sm, v) => sm + v.pax_count * (v.duration_minutes ?? 0), 0) + activeSeatMin
  const opMin = operatingMinutes(from, to, s)
  const seatUtilization = Math.min(100, Math.round((occSeatMin / (s.max_capacity * opMin)) * 100))
  // peak-hour utilization: pax in peak hour vs capacity
  const peakHourUtilization = peak ? Math.min(100, Math.round((peak.pax / s.max_capacity) * 100)) : 0

  const noShows = raw.queue.filter(q => q.status === 'no_show')
  const cancels = raw.queue.filter(q => q.status === 'cancelled')
  const joined = raw.queue.length
  const seatedFromQueue = raw.queue.filter(q => q.status === 'seated').length
  const lostByReason: Record<string, number> = {}
  for (const l of raw.lost) lostByReason[l.reason ?? 'Other'] = (lostByReason[l.reason ?? 'Other'] ?? 0) + l.pax_count

  return {
    paxServed, groupsServed,
    avgDuration: Math.round(mean(durations)), medianDuration: Math.round(median(durations)),
    fastestTurn: durations.length ? Math.min(...durations) : null,
    slowestTurn: durations.length ? Math.max(...durations) : null,
    turnoverCount: groupsServed, avgPaxPerGroup: groupsServed ? Math.round((paxServed / groupsServed) * 10) / 10 : 0,
    seatUtilization, peakHour, peakHourUtilization,
    lostPax: raw.lost.reduce((sm, l) => sm + l.pax_count, 0),
    noShows: noShows.length, cancellations: cancels.length,
    noShowRate: joined ? Math.round((noShows.length / joined) * 100) : 0,
    cancelRate: joined ? Math.round((cancels.length / joined) * 100) : 0,
    queueConversion: joined ? Math.round((seatedFromQueue / joined) * 100) : 0,
    lostByReason, paxByHour,
  }
}

// ---------------- good day / bad day score (edit the points here) ----------------
export function scoreDay(m: Metrics, s: Settings): { score: number; status: 'Good day' | 'Average day' | 'Bad day'; reasons: string[] } {
  let score = 0
  const good: string[] = [], bad: string[] = []
  if (m.paxServed >= s.good_day_target_pax) { score += 30; good.push('high pax served') }
  if (m.seatUtilization >= s.target_utilization) { score += 20; good.push('strong seat utilization') }
  if (m.avgDuration > 0 && m.avgDuration <= s.target_average_duration) { score += 20; good.push('healthy dining duration') }
  if (m.lostPax <= s.lost_pax_good_threshold) { score += 10; good.push('few lost customers') }
  if (m.noShowRate <= s.no_show_good_threshold) { score += 10; good.push('low no-show rate') }
  if (m.peakHourUtilization >= s.peak_utilization_target) { score += 10; good.push('high peak-hour utilization') }

  if (m.avgDuration > s.target_average_duration * 1.25) { score -= 20; bad.push('dining duration too long') }
  if (m.lostPax > s.lost_pax_bad_threshold) { score -= 20; bad.push('high lost customers') }
  if (m.noShowRate > s.no_show_good_threshold * 2) { score -= 10; bad.push('high no-show rate') }
  if (m.cancelRate > 20) { score -= 10; bad.push('high cancellation rate') }
  if (m.seatUtilization > 0 && m.seatUtilization < s.target_utilization * 0.6) { score -= 20; bad.push('low seat utilization') }

  score = Math.max(0, Math.min(100, score))
  const status = score >= 70 ? 'Good day' : score >= 40 ? 'Average day' : 'Bad day'
  const reasons = status === 'Bad day' && bad.length ? bad : good.length ? good : ['not enough data yet']
  return { score, status, reasons }
}

// ---------------- dashboard ----------------
export async function getDashboard() {
  const s = await getSettings()
  const from = startOfDayMYT(), to = addDays(from, 1)
  const [raw, active] = await Promise.all([rangeData(from, to), activeVisits()])
  const activeSeatMin = active.reduce((sm, v) => sm + v.pax_count * minsSince(v.seated_at), 0)
  const m = metricsFrom(raw, s, from, to, activeSeatMin)
  const score = scoreDay(m, s)
  const seated = active.reduce((sm, v) => sm + v.pax_count, 0)
  const tables = await listTables()
  const waiting = raw.queue.filter(q => q.status === 'waiting')
  const live = {
    seatedPax: seated, maxCapacity: s.max_capacity, availableSeats: s.max_capacity - seated,
    waitingGroups: waiting.length, waitingPax: waiting.reduce((x, q) => x + q.party_size, 0),
    tablesSeated: tables.filter(t => t.status === 'seated').length,
    tablesCleaning: tables.filter(t => t.status === 'cleaning').length,
    tablesAvailable: tables.filter(t => t.status === 'available').length,
  }
  const tablePerf = tablePerformance(raw, tables)
  return { settings: s, live, metrics: m, score, tablePerf }
}

function tablePerformance(raw: Raw, tables: OpsTable[]) {
  const vById = new Map(raw.visits.map(v => [v.id, v]))
  const byTable = new Map<string, { turns: number; pax: number; mins: number[]; occ: number }>()
  for (const vt of raw.visitTables) {
    const v = vById.get(vt.visit_id); if (!v || v.status !== 'completed') continue
    const cur = byTable.get(vt.table_id) ?? { turns: 0, pax: 0, mins: [], occ: 0 }
    cur.turns += 1; cur.pax += v.pax_count; cur.occ += v.duration_minutes ?? 0
    if (v.duration_minutes) cur.mins.push(v.duration_minutes)
    byTable.set(vt.table_id, cur)
  }
  return tables.map(t => {
    const d = byTable.get(t.id) ?? { turns: 0, pax: 0, mins: [], occ: 0 }
    return { code: t.label, turns: d.turns, pax: d.pax, avgDuration: Math.round(mean(d.mins)), occupiedMin: d.occ }
  }).sort((a, b) => b.turns - a.turns)
}

// ---------------- reports (date range) ----------------
export async function getReport(from: Date, to: Date) {
  const s = await getSettings()
  const raw = await rangeData(from, to)
  const m = metricsFrom(raw, s, from, to)
  const tables = await listTables()
  // best/worst day by pax served
  const byDay = new Map<string, number>()
  for (const v of raw.visits.filter(v => v.status === 'completed')) byDay.set(mytDayKey(v.seated_at), (byDay.get(mytDayKey(v.seated_at)) ?? 0) + v.pax_count)
  const days = Array.from(byDay.entries()).map(([date, pax]) => ({ date, pax }))
  const bestDay = days.slice().sort((a, b) => b.pax - a.pax)[0] ?? null
  const worstDay = days.slice().sort((a, b) => a.pax - b.pax)[0] ?? null
  const hours = m.paxByHour.slice().sort((a, b) => b.pax - a.pax)
  const bestHour = hours[0] ? `${String(hours[0].hour).padStart(2, '0')}:00` : '—'
  const worstHour = hours[hours.length - 1] ? `${String(hours[hours.length - 1].hour).padStart(2, '0')}:00` : '—'
  return { settings: s, metrics: m, bestDay, worstDay, bestHour, worstHour, tablePerf: tablePerformance(raw, tables) }
}

// Resolve a named period to a [from,to) range (MYT day boundaries).
export function periodRange(period: string, fromStr?: string, toStr?: string): { from: Date; to: Date } {
  const today = startOfDayMYT()
  if (period === 'today') return { from: today, to: addDays(today, 1) }
  if (period === 'yesterday') return { from: addDays(today, -1), to: today }
  if (period === 'week') return { from: addDays(today, -6), to: addDays(today, 1) }
  if (period === 'month') return { from: addDays(today, -29), to: addDays(today, 1) }
  if (period === 'custom' && fromStr && toStr) {
    return { from: startOfDayMYT(new Date(fromStr)), to: addDays(startOfDayMYT(new Date(toStr)), 1) }
  }
  return { from: today, to: addDays(today, 1) }
}
