'use client'
import { useState, useMemo } from 'react'
import type { Employee } from '@/lib/employees'

// Client component — interactive filters. `import type` above is erased at build,
// so this never pulls lib/employees -> lib/supabase (the service_role key) into
// the browser bundle. Formatters are redefined locally for the same reason.
const rm = (n: number) => 'RM ' + Number(n || 0).toLocaleString('en-MY')
const labelize = (s: string) => s.replace(/_/g, ' ')
const WEEKS_PER_MONTH = 4.33 // avg weeks/month, for monthly cost from weekly hours

export default function HRView({ employees }: { employees: Employee[] }) {
  const [dept, setDept] = useState('all')
  const [type, setType] = useState('all') // all | full_time | part_time

  const departments = useMemo(
    () => Array.from(new Set(employees.map(e => e.department).filter(Boolean))).sort() as string[],
    [employees],
  )

  const filtered = useMemo(
    () => employees.filter(e =>
      (dept === 'all' || e.department === dept) &&
      (type === 'all' || e.employment_type === type),
    ),
    [employees, dept, type],
  )

  // Stats reflect the current filter, and exclude anyone who has left.
  const onTeam = filtered.filter(e => e.status !== 'left')
  const fullTime = filtered.filter(e => e.employment_type === 'full_time').length
  const partTime = filtered.filter(e => e.employment_type === 'part_time').length
  const weeklyHours = onTeam.reduce((s, e) => s + Number(e.weekly_hours || 0), 0)
  const monthlyCost = onTeam.reduce(
    (s, e) => s + (e.pay_type === 'monthly'
      ? Number(e.monthly_salary || 0)
      : Number(e.hourly_rate || 0) * Number(e.weekly_hours || 0) * WEEKS_PER_MONTH),
    0,
  )

  const cards: [string, string | number][] = [
    ['Headcount', filtered.length],
    ['Full-time', fullTime],
    ['Part-time', partTime],
    ['Weekly hours', `${weeklyHours} h`],
    ['Monthly cost', rm(Math.round(monthlyCost))],
  ]

  return (
    <>
      <div className="grid">
        {cards.map(([l, v]) => (
          <div className="stat" key={l}><p className="l">{l}</p><p className="v">{v}</p></div>
        ))}
      </div>

      <div className="filters">
        <select className="select" value={dept} onChange={e => setDept(e.target.value)} aria-label="Filter by department">
          <option value="all">All departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="select" value={type} onChange={e => setType(e.target.value)} aria-label="Filter by employment type">
          <option value="all">All types</option>
          <option value="full_time">Full-time</option>
          <option value="part_time">Part-time</option>
        </select>
        <span className="filter-count">{filtered.length} of {employees.length}</span>
      </div>

      {filtered.length === 0 ? (
        <p className="empty">No employees match these filters.</p>
      ) : (
        <table className="tbl">
          <thead><tr>
            <th>Name</th><th>Role</th><th>Department</th><th>Type</th><th>Status</th><th>Hours/wk</th><th>Rate</th>
          </tr></thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id}>
                <td data-label="Name">{e.name}</td>
                <td data-label="Role">{e.role ?? '—'}</td>
                <td data-label="Department">{e.department ?? '—'}</td>
                <td data-label="Type"><span className={`pill ${e.employment_type}`}>{labelize(e.employment_type)}</span></td>
                <td data-label="Status"><span className={`pill ${e.status}`}>{labelize(e.status)}</span></td>
                <td data-label="Hours/wk">{e.weekly_hours ? `${e.weekly_hours} h` : '—'}</td>
                <td data-label="Rate">{e.pay_type === 'monthly'
                  ? (e.monthly_salary ? `${rm(e.monthly_salary)}/mo` : '—')
                  : (e.hourly_rate ? `${rm(e.hourly_rate)}/h` : '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
