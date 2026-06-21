'use client'
import { useMemo, useState } from 'react'
import type { Employee } from '@/lib/employees'

// Client component — interactive month/staff/department filters. `import type` is
// erased at build, so lib/employees -> lib/supabase (service_role key) never
// reaches the browser bundle.
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const JS_TO_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] // Date.getDay() -> name
const PALETTE = ['#8ec5ff', '#86e0b8', '#ffcf80', '#ff9b9b', '#c4a3ff', '#7fe3d4', '#f7a3d0', '#b6d97a']

const UserIcon = () => (
  <svg viewBox="0 0 24 24" width="11" height="11" className="ic-user" aria-hidden="true">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
)

export default function Calendar({ employees }: { employees: Employee[] }) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [staff, setStaff] = useState('all')
  const [dept, setDept] = useState('all')

  // Stable department -> colour map (from the whole team, so colours don't shift
  // when you filter).
  const depts = useMemo(
    () => Array.from(new Set(employees.map(e => e.department).filter(Boolean))).sort() as string[],
    [employees],
  )
  const colorOf = (d: string | null) => (d ? PALETTE[depts.indexOf(d) % PALETTE.length] : '#a1a1aa')

  // Department (legend click) AND staff (dropdown) filters combine.
  const shown = useMemo(
    () => employees.filter(e =>
      (dept === 'all' || e.department === dept) &&
      (staff === 'all' || e.name === staff),
    ),
    [employees, dept, staff],
  )

  // Month grid (Mon-first).
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7
  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const isThisMonth = year === now.getFullYear() && month === now.getMonth()
  const ymValue = `${year}-${String(month + 1).padStart(2, '0')}`
  const workingOn = (date: number) => {
    const name = JS_TO_DAY[new Date(year, month, date).getDay()]
    return shown.filter(e => (e.work_days ?? []).includes(name))
  }

  return (
    <>
      {/* Click a department to filter; click it again to clear. */}
      <div className="legend">
        {depts.map(d => {
          const active = dept === d
          return (
            <button
              key={d}
              type="button"
              className={`legend-item${active ? ' active' : ''}${dept !== 'all' && !active ? ' dim' : ''}`}
              onClick={() => setDept(active ? 'all' : d)}
              aria-pressed={active}
            >
              <span className="dot" style={{ background: colorOf(d) }} /> {d}
            </button>
          )
        })}
      </div>

      <div className="filters">
        <input
          type="month"
          className="select month-input"
          value={ymValue}
          onChange={e => {
            const [y, m] = e.target.value.split('-').map(Number)
            if (y && m) { setYear(y); setMonth(m - 1) }
          }}
          aria-label="Month and year"
        />
        <select className="select" value={staff} onChange={e => setStaff(e.target.value)} aria-label="Staff">
          <option value="all">All staff</option>
          {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
        </select>
      </div>

      <div className="cal">
        {WEEKDAYS.map(d => <div className="cal-h" key={d}>{d}</div>)}
        {cells.map((n, i) => {
          if (n === null) return <div className="cal-cell blank" key={i} />
          const people = workingOn(n)
          return (
            <div className={`cal-cell${isThisMonth && n === now.getDate() ? ' today' : ''}`} key={i}>
              <div className="cal-date">
                <span>{n}</span>
                {people.length > 0 && (
                  <span className="cal-count"><UserIcon />{people.length}</span>
                )}
              </div>
              <div className="cal-names">
                {people.map(e => {
                  const c = colorOf(e.department)
                  return (
                    <span className="name-chip" key={e.id} style={{ color: c, background: `${c}1a` }} title={e.department ?? ''}>
                      {e.name}
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
