import { getRecords, m } from '@/lib/records'
import Empty from '@/app/_components/Empty'

export const dynamic = 'force-dynamic'

// Social content calendar. category === 'content'. Extra fields live in `meta`.
export default async function Content() {
  const all = await getRecords()
  const rows = all.filter(r => r.category === 'content')
  const drafts = rows.filter(r => r.status === 'draft').length
  const scheduled = rows.filter(r => r.status === 'scheduled').length
  const posted = rows.filter(r => r.status === 'posted').length

  const cards: [string, number][] = [
    ['Drafts', drafts],
    ['Scheduled', scheduled],
    ['Posted', posted],
  ]

  return (
    <>
      <h1 className="ph">Content</h1>
      <p className="cap">Your posting calendar</p>
      <div className="grid">
        {cards.map(([l, v]) => (
          <div className="stat" key={l}><p className="l">{l}</p><p className="v">{v}</p></div>
        ))}
      </div>
      {rows.length === 0 ? <Empty /> : (
        <table className="tbl">
          <thead><tr><th>Title</th><th>Platform</th><th>Format</th><th>Status</th><th>Date</th><th>Views</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td data-label="Title">{r.title}</td>
                <td data-label="Platform">{m(r, 'platform')}</td>
                <td data-label="Format">{m(r, 'format')}</td>
                <td data-label="Status"><span className={`pill ${r.status}`}>{r.status}</span></td>
                <td data-label="Date">{r.due_date ?? '—'}</td>
                <td data-label="Views">{r.meta?.views != null ? Number(r.meta.views).toLocaleString('en-MY') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
