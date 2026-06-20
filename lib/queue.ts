import { supabase, supabaseConfigured } from './supabase'

// Server-only: this imports lib/supabase (service_role key). NEVER import into a
// 'use client' component — the queue pages talk to the server via /api/queue/* only.

export type QStatus = 'waiting' | 'called' | 'arrived' | 'no_show' | 'cancelled'

export type QueueEntry = {
  id: string
  name: string
  party_size: number
  phone: string | null
  status: QStatus
  queue_number: number
  table_number: string | null
  created_at: string
  called_at: string | null
  seated_at: string | null
}

// "In the line" = still waiting or currently being called.
export const ACTIVE: QStatus[] = ['waiting', 'called']

// Start of "today" in Malaysia time (UTC+8), returned as a UTC ISO string — so
// queue numbers reset at local midnight, not at 8am (UTC midnight).
function startOfTodayMYT(): string {
  const off = 8 * 60 * 60 * 1000
  const d = new Date(Date.now() + off)
  d.setUTCHours(0, 0, 0, 0)
  return new Date(d.getTime() - off).toISOString()
}

// Short in-process cache for the average wait. Every waiting phone polls the
// status endpoint, so without this each poll would hit queue_settings — at 300
// guests that's a needless flood of identical reads. 15s staleness is fine for
// an estimate, and a staff change still shows up within ~15s.
let avgCache: { v: number; t: number } | null = null

export async function getAvgMinutes(): Promise<number> {
  if (avgCache && Date.now() - avgCache.t < 15_000) return avgCache.v
  if (!supabaseConfigured) return 45
  const { data } = await supabase.from('queue_settings').select('avg_minutes').eq('id', 1).maybeSingle()
  const v = data?.avg_minutes ?? 45
  avgCache = { v, t: Date.now() }
  return v
}

export async function setAvgMinutes(min: number): Promise<void> {
  await supabase.from('queue_settings').upsert({ id: 1, avg_minutes: min })
  avgCache = { v: min, t: Date.now() } // reflect the change immediately
}

export async function todaysEntries(): Promise<QueueEntry[]> {
  if (!supabaseConfigured) return []
  const { data, error } = await supabase
    .from('queue_entries')
    .select('*')
    .gte('created_at', startOfTodayMYT())
    .order('queue_number', { ascending: true })
  if (error) { console.warn('[queue] read failed:', error.message); return [] }
  return (data ?? []) as QueueEntry[]
}

export async function createEntry(name: string, partySize: number, phone: string | null): Promise<QueueEntry> {
  // queue_number is assigned atomically by the DB trigger (assign_queue_number,
  // see supabase/queue-scale.sql), so concurrent joins can never collide — we no
  // longer compute it in JS. The DB also gives us the assigned number back.
  const { data, error } = await supabase
    .from('queue_entries')
    .insert({ name, party_size: partySize, phone, status: 'waiting' })
    .select().single()
  if (error) throw new Error(error.message)
  return data as QueueEntry
}

export async function getEntry(id: string): Promise<QueueEntry | null> {
  if (!supabaseConfigured || !id) return null
  const { data } = await supabase.from('queue_entries').select('*').eq('id', id).maybeSingle()
  return (data ?? null) as QueueEntry | null
}

export async function patchEntry(id: string, patch: Partial<QueueEntry>): Promise<void> {
  await supabase.from('queue_entries').update(patch).eq('id', id)
}

// How many active groups sit ahead of this one (lower queue_number, still in
// line). Used by the staff console, which already has every row loaded.
export function groupsAhead(entry: QueueEntry, all: QueueEntry[]): number {
  return all.filter(e => ACTIVE.includes(e.status) && e.queue_number < entry.queue_number).length
}

// Same count, but as a DB-side COUNT instead of pulling every row — this is what
// the customer status endpoint uses on every poll, so 300 phones polling don't
// each transfer the whole day's table. Cancellations drop out automatically
// (cancelled isn't in ACTIVE), so positions shrink as people leave.
export async function groupsAheadCount(entry: QueueEntry): Promise<number> {
  if (!supabaseConfigured) return 0
  const { count, error } = await supabase
    .from('queue_entries')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startOfTodayMYT())
    .in('status', ACTIVE)
    .lt('queue_number', entry.queue_number)
  if (error) { console.warn('[queue] ahead-count failed:', error.message); return 0 }
  return count ?? 0
}

// ---- Restaurant tables (floor layout) ----

export type RTable = {
  id: string
  zone: string
  label: string
  seats: number
  sort: number
  occupied_by: string | null // queue_entries.id, or null when free
}

export async function listTables(): Promise<RTable[]> {
  if (!supabaseConfigured) return []
  const { data, error } = await supabase.from('restaurant_tables').select('*').order('sort', { ascending: true })
  if (error) { console.warn('[queue] tables read failed:', error.message); return [] }
  return (data ?? []) as RTable[]
}

export async function getTable(id: string): Promise<RTable | null> {
  if (!supabaseConfigured || !id) return null
  const { data } = await supabase.from('restaurant_tables').select('*').eq('id', id).maybeSingle()
  return (data ?? null) as RTable | null
}

export async function occupyTable(tableId: string, entryId: string): Promise<void> {
  await supabase.from('restaurant_tables').update({ occupied_by: entryId }).eq('id', tableId)
}

export async function freeTable(tableId: string): Promise<void> {
  await supabase.from('restaurant_tables').update({ occupied_by: null }).eq('id', tableId)
}

// Free every table seated to the same guest (releases a combined group at once).
export async function freeTablesByEntry(entryId: string): Promise<void> {
  await supabase.from('restaurant_tables').update({ occupied_by: null }).eq('occupied_by', entryId)
}

// Staff PIN check. Never throws; false when no PIN configured.
export function checkPin(pin: string | null | undefined): boolean {
  const real = (process.env.QUEUE_STAFF_PIN ?? '').trim()
  if (!real) return false
  return (pin ?? '').trim() === real
}
