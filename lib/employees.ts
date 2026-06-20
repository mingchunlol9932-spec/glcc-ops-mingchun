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

export async function getEmployees(): Promise<Employee[]> {
  // Skip the call before Supabase is wired (placeholder env) — same guard as
  // getRecords. If the employees table doesn't exist yet, we log and return []
  // so the HR tab shows its "run employees.sql" hint instead of crashing.
  if (!supabaseConfigured) return []
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('name', { ascending: true })
  if (error) {
    console.warn('[GLCC] could not read employees:', error.message)
    return []
  }
  return (data ?? []) as Employee[]
}

// 'full_time' -> 'full time', 'on_leave' -> 'on leave' (for display only;
// the raw value still drives the .pill CSS class).
export const labelize = (s: string) => s.replace(/_/g, ' ')
