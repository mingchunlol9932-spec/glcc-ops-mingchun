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

export async function getAvgMinutes(): Promise<number> {
  if (!supabaseConfigured) return 45
  const { data } = await supabase.from('queue_settings').select('avg_minutes').eq('id', 1).maybeSingle()
  return data?.avg_minutes ?? 45
}

export async function setAvgMinutes(min: number): Promise<void> {
  await supabase.from('queue_settings').upsert({ id: 1, avg_minutes: min })
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
  const today = await todaysEntries()
  const next = today.reduce((m, e) => Math.max(m, e.queue_number), 0) + 1
  const { data, error } = await supabase
    .from('queue_entries')
    .insert({ name, party_size: partySize, phone, status: 'waiting', queue_number: next })
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

// How many active groups sit ahead of this one (lower queue_number, still in line).
export function groupsAhead(entry: QueueEntry, all: QueueEntry[]): number {
  return all.filter(e => ACTIVE.includes(e.status) && e.queue_number < entry.queue_number).length
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

// Staff PIN check. Never throws; false when no PIN configured.
export function checkPin(pin: string | null | undefined): boolean {
  const real = (process.env.QUEUE_STAFF_PIN ?? '').trim()
  if (!real) return false
  return (pin ?? '').trim() === real
}
