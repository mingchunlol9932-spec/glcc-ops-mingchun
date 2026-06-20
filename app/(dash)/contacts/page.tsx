import { getRecords, m } from '@/lib/records'
import Empty from '@/app/_components/Empty'

export const dynamic = 'force-dynamic'

// A lightweight CRM. category === 'contact'. Extra fields live in `meta`.
export default async function Contacts() {
  const all = await getRecords()
  const rows = all.filter(r => r.category === 'contact')

  return (
    <>
      <h1 className="ph">Contacts</h1>
      <p className="cap">People &amp; companies · {rows.length} total</p>
      {rows.length === 0 ? <Empty /> : (
        <table className="tbl">
          <thead><tr><th>Name</th><th>Company</th><th>Role</th><th>Source</th><th>Last contact</th><th>Next action</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td data-label="Name">{r.title}</td>
                <td data-label="Company">{m(r, 'company')}</td>
                <td data-label="Role">{m(r, 'role')}</td>
                <td data-label="Source">{m(r, 'source')}</td>
                <td data-label="Last contact">{m(r, 'last_contact')}</td>
                <td data-label="Next action">{m(r, 'next')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
