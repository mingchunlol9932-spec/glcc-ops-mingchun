import { getEmployees, getOverrides } from '@/lib/employees'
import Calendar from './Calendar'

export const dynamic = 'force-dynamic'

export default async function Timetable() {
  // Everyone still employed; the calendar decides per-day who works (weekly
  // pattern + date overrides), so on-leave staff can still be added to a date.
  const team = (await getEmployees()).filter(e => e.status !== 'left')
  const overrides = await getOverrides()

  return (
    <>
      <h1 className="ph">Timetable</h1>
      <p className="cap">Who&apos;s working, colour-coded by department</p>
      {team.length === 0 ? (
        <p className="empty">
          No working employees yet — add staff and their <code>work_days</code> in the
          {' '}<code>employees</code> table (run <code>supabase/employees.sql</code>), then refresh.
        </p>
      ) : (
        <Calendar employees={team} overrides={overrides} />
      )}
    </>
  )
}
