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
  { id: 1, name: 'Aisyah Rahman', role: 'Head Chef',   department: 'Kitchen',        employment_type: 'full_time', status: 'active',    hourly_rate: 25, weekly_hours: 45, start_date: '2024-01-15', email: 'aisyah@example.com', work_days: ['Mon','Tue','Wed','Thu','Fri'], created_at: '2024-01-15' },
  { id: 2, name: 'Daniel Tan',    role: 'Sous Chef',    department: 'Kitchen',        employment_type: 'full_time', status: 'probation', hourly_rate: 18, weekly_hours: 40, start_date: '2026-05-01', email: 'daniel@example.com', work_days: ['Tue','Wed','Thu','Fri','Sat'], created_at: '2026-05-01' },
  { id: 3, name: 'Mei Ling',      role: 'Server',       department: 'Front of House', employment_type: 'part_time', status: 'active',    hourly_rate: 12, weekly_hours: 20, start_date: '2025-03-10', email: 'mei@example.com',    work_days: ['Fri','Sat','Sun'], created_at: '2025-03-10' },
  { id: 4, name: 'Kumar Raj',     role: 'Server',       department: 'Front of House', employment_type: 'part_time', status: 'active',    hourly_rate: 12, weekly_hours: 24, start_date: '2025-08-22', email: 'kumar@example.com',  work_days: ['Wed','Thu','Fri','Sat'], created_at: '2025-08-22' },
  { id: 5, name: 'Siti Nur',      role: 'Manager',      department: 'Admin',          employment_type: 'full_time', status: 'active',    hourly_rate: 30, weekly_hours: 40, start_date: '2023-11-01', email: 'siti@example.com',   work_days: ['Mon','Tue','Wed','Thu','Fri'], created_at: '2023-11-01' },
  { id: 6, name: 'Jason Lee',     role: 'Dishwasher',   department: 'Kitchen',        employment_type: 'part_time', status: 'on_leave',  hourly_rate: 10, weekly_hours: 16, start_date: '2025-12-05', email: 'jason@example.com',  work_days: ['Sat','Sun'], created_at: '2025-12-05' },
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
