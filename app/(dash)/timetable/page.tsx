import { getEmployees } from '@/lib/employees'
import Calendar from './Calendar'

export const dynamic = 'force-dynamic'

export default async function Timetable() {
  // Only people actually working show on the calendar (skip on-leave / departed).
  const team = (await getEmployees()).filter(e => e.status !== 'left' && e.status !== 'on_leave')

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
        <Calendar employees={team} />
      )}
    </>
  )
}
