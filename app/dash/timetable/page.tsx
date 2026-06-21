import { getEmployees, getOverrides } from '@/lib/employees'
// Reuse the override-aware calendar (the one that applies shift_overrides), so
// the dashboard timetable and the standalone /timetable stay in sync — no
// duplicated logic, and "off next week" reflects in both.
import Calendar from '@/app/(staff)/timetable/Calendar'

export const dynamic = 'force-dynamic'

export default async function Timetable() {
  // Keep everyone still employed — the calendar decides per-day who works
  // (weekly pattern + date overrides), so someone on leave can still be shown
  // working on a specific date via an override.
  const team = (await getEmployees()).filter(e => e.status !== 'left')
  const overrides = await getOverrides()

  return (
    <>
      <h1 className="ph">Timetable</h1>
      <p className="cap">Who&apos;s working, colour-coded by department</p>
      {team.length === 0 ? (
        <p className="empty">
          No employees yet — add staff and their <code>work_days</code> in the
          {' '}<code>employees</code> table, then refresh.
        </p>
      ) : (
        <Calendar employees={team} overrides={overrides} />
      )}
    </>
  )
}
