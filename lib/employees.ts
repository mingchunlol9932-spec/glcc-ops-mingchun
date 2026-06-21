import { supabase, supabaseConfigured } from './supabase'

// One row = one team member. Lives in its own `employees` table (created by
// supabase/employees.sql) so HR can track employment type + working hours
// cleanly, separate from the universal `records` table the other tabs use.
export type Employee = {
  id: number
  name: string
  role: string | null
  department: string | null
  employment_type: string   // 'full_time' | 'part_time'
  status: string            // 'active' | 'on_leave' | 'probation' | 'left'
  hourly_rate: number       // RM per hour
  weekly_hours: number      // contracted hours per week
  start_date: string | null
  email: string | null
  work_days: string[] | null  // e.g. ['Mon','Tue','Wed','Thu','Fri']
  created_at: string
}

// TEMP dummy team so the HR + Timetable tabs render with content before the
// `employees` table is seeded. Returned only when the real table is missing or
// empty — real rows take over automatically once supabase/employees.sql is run.
// Safe to delete this block (and the two fallbacks below) after seeding.
const DUMMY_EMPLOYEES: Employee[] = [
  { id: 1, name: 'Ming',         role: 'CEO / Founder',                department: 'Management',              employment_type: 'full_time', status: 'active', hourly_rate: 60, weekly_hours: 50, start_date: '2023-01-01', email: 'ming@gepuklah.com',  work_days: ['Mon','Tue','Wed','Thu','Fri','Sat'], created_at: '2023-01-01' },
  { id: 2, name: 'Mel Lee',      role: 'Head of Staff',                department: 'Management',              employment_type: 'full_time', status: 'active', hourly_rate: 35, weekly_hours: 45, start_date: '2023-06-01', email: 'mel@gepuklah.com',   work_days: ['Mon','Tue','Wed','Thu','Fri'], created_at: '2023-06-01' },
  { id: 3, name: 'Amir',         role: 'Head Chef + Supplier Liaison', department: 'Kitchen',                 employment_type: 'full_time', status: 'active', hourly_rate: 30, weekly_hours: 48, start_date: '2023-03-01', email: 'amir@gepuklah.com',  work_days: ['Tue','Wed','Thu','Fri','Sat','Sun'], created_at: '2023-03-01' },
  { id: 4, name: 'Kelly',        role: 'Accountant + Purchasing',      department: 'Finance / Admin',         employment_type: 'full_time', status: 'active', hourly_rate: 28, weekly_hours: 40, start_date: '2024-02-01', email: 'kelly@gepuklah.com', work_days: ['Mon','Tue','Wed','Thu','Fri'], created_at: '2024-02-01' },
  { id: 5, name: 'Service Crew', role: 'Full-Time Service Crew',       department: 'Operations / Restaurant', employment_type: 'full_time', status: 'active', hourly_rate: 12, weekly_hours: 45, start_date: '2024-01-01', email: 'crew@gepuklah.com',  work_days: ['Wed','Thu','Fri','Sat','Sun'], created_at: '2024-01-01' },
]

export async function getEmployees(): Promise<Employee[]> {
  // Skip the call before Supabase is wired (placeholder env) — same guard as
  // getRecords. Falls back to DUMMY_EMPLOYEES so the HR/Timetable tabs show
  // sample content instead of an empty state until the real table is seeded.
  if (!supabaseConfigured) return DUMMY_EMPLOYEES
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('name', { ascending: true })
  if (error) {
    console.warn('[GLCC] could not read employees:', error.message)
    return DUMMY_EMPLOYEES
  }
  const rows = (data ?? []) as Employee[]
  return rows.length ? rows : DUMMY_EMPLOYEES
}

// 'full_time' -> 'full time', 'on_leave' -> 'on leave' (for display only;
// the raw value still drives the .pill CSS class).
export const labelize = (s: string) => s.replace(/_/g, ' ')

// ---- Staff availability (8am digest + Telegram bot updates) ----
export const WORKING_STATUSES = ['active', 'probation']
export const LEAVE_LABEL: Record<string, string> = { mc: 'medical', annual_leave: 'annual', on_leave: 'leave' }
export const isWorking = (s: string) => WORKING_STATUSES.includes(s)
export const isOnLeave = (s: string) => s in LEAVE_LABEL

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// A one-day exception to the weekly pattern: someone works ('work') or is off
// ('off') on a specific date, regardless of their usual work_days.
export type Override = {
  id: number
  name: string
  date: string          // 'YYYY-MM-DD'
  kind: 'work' | 'off'
  reason: string | null
  created_at: string
}

export async function getOverrides(): Promise<Override[]> {
  if (!supabaseConfigured) return []
  const { data, error } = await supabase.from('shift_overrides').select('*')
  if (error) { console.warn('[GLCC] could not read shift_overrides:', error.message); return [] }
  return (data ?? []) as Override[]
}

export async function upsertOverride(name: string, date: string, kind: 'work' | 'off', reason: string | null): Promise<boolean> {
  if (!supabaseConfigured) return false
  const { error } = await supabase.from('shift_overrides').upsert({ name, date, kind, reason }, { onConflict: 'name,date' })
  if (error) { console.warn('[GLCC] upsertOverride failed:', error.message); return false }
  return true
}

export const ovKey = (name: string, dateISO: string) => `${name}|${dateISO}`
export function ovMapOf(overrides: Override[]): Map<string, Override> {
  const m = new Map<string, Override>()
  for (const o of overrides) m.set(ovKey(o.name, o.date), o)
  return m
}

// Working on this date? An override wins over the weekly pattern; 'left' never works.
export function worksOn(e: Employee, weekday: string, dateISO: string, ov: Map<string, Override>): boolean {
  if (e.status === 'left') return false
  const o = ov.get(ovKey(e.name, dateISO))
  if (o) return o.kind === 'work'
  return isWorking(e.status) && (e.work_days ?? []).includes(weekday)
}

const isoUTC = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`

// 'YYYY-MM-DD' -> 'Sat 21 Jun' for friendly confirmations.
export function prettyDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return `${WD[dt.getUTCDay()]} ${d} ${MO[m - 1]}`
}

// "Today" in Malaysia (UTC+8), so a 00:00-UTC cron reads the correct weekday.
export function staffToday(team: Employee[], overrides: Override[] = []) {
  const myt = new Date(Date.now() + 8 * 3600 * 1000)
  const day = WD[myt.getUTCDay()]
  const dateISO = isoUTC(myt)
  const dateLabel = `${day} ${myt.getUTCDate()} ${MO[myt.getUTCMonth()]}`
  const ov = ovMapOf(overrides)
  const alive = team.filter(e => e.status !== 'left')

  const working = alive.filter(e => worksOn(e, day, dateISO, ov))
  const workingNames = new Set(working.map(e => e.name))
  const onLeave = alive.flatMap(e => {
    if (workingNames.has(e.name)) return []
    const o = ov.get(ovKey(e.name, dateISO))
    if (o && o.kind === 'off') return [{ name: e.name, reason: o.reason || 'off' }]
    if (isOnLeave(e.status)) return [{ name: e.name, reason: LEAVE_LABEL[e.status] }]
    return []
  })
  const offNames = new Set(onLeave.map(x => x.name))
  const offToday = alive.filter(e => !workingNames.has(e.name) && !offNames.has(e.name))
  return { day, dateLabel, working, onLeave, offToday }
}

// The Telegram message body — shared by the cron and the on-demand bot reply.
export function staffMessage(team: Employee[], overrides: Override[] = []): string {
  const { dateLabel, working, onLeave, offToday } = staffToday(team, overrides)
  return (
    `☀️ <b>Staff today — ${dateLabel}</b>\n` +
    `\n✅ <b>Working (${working.length}):</b>\n` +
    (working.length ? working.map(e => `• ${e.name}${e.department ? ` <i>(${e.department})</i>` : ''}`).join('\n') : '• —') +
    (onLeave.length
      ? `\n\n🤒 <b>On leave (${onLeave.length}):</b>\n` + onLeave.map(x => `• ${x.name} — ${x.reason}`).join('\n')
      : `\n\n🟢 Nobody on leave today.`) +
    (offToday.length ? `\n\n😴 <b>Off (not scheduled):</b> ${offToday.map(e => e.name).join(', ')}` : '')
  )
}

// Map a leave reason to a permanent DB status (used when no date is given).
export const STATUS_FROM_REASON: Record<string, string> = {
  mc: 'mc', annual: 'annual_leave', leave: 'on_leave', extra: 'active', working: 'active',
}

export async function setEmployeeStatus(name: string, status: string): Promise<boolean> {
  if (!supabaseConfigured) return false
  const { error } = await supabase.from('employees').update({ status }).eq('name', name)
  if (error) { console.warn('[GLCC] setEmployeeStatus failed:', error.message); return false }
  return true
}
