import { getEmployees } from '@/lib/employees'
import HRView from './HRView'

export const dynamic = 'force-dynamic'

// Human Resources. Server fetches the dedicated `employees` table, then hands
// it to HRView (client) which renders the filterable stats + table.
export default async function HR() {
  const team = await getEmployees()

  return (
    <>
      <h1 className="ph">HR</h1>
      <p className="cap">Your team &amp; working hours</p>
      {team.length === 0 ? (
        <p className="empty">
          No employees yet — run <code>supabase/employees.sql</code> in your Supabase SQL editor
          to create the <code>employees</code> table and seed your team, then refresh.
        </p>
      ) : (
        <HRView employees={team} />
      )}
    </>
  )
}
