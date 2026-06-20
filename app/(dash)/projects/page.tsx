import { getRecords, rm, m } from '@/lib/records'
import Empty from '@/app/_components/Empty'

export const dynamic = 'force-dynamic'

// Active client work. category === 'project'. Extra fields live in `meta`.
export default async function Projects() {
  const all = await getRecords()
  const rows = all.filter(r => r.category === 'project')
  const active = rows.filter(r => r.status === 'active').length
  const budget = rows.reduce((s, r) => s + Number(r.amount || 0), 0)
  const pcts = rows.map(r => Number(r.meta?.pct)).filter(n => !Number.isNaN(n))
  const avgPct = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0

  const cards: [string, string | number][] = [
    ['Active', active],
    ['Total budget', rm(budget)],
    ['Avg % complete', `${avgPct}%`],
  ]

  return (
    <>
      <h1 className="ph">Projects</h1>
      <p className="cap">Active client work</p>
      <div className="grid">
        {cards.map(([l, v]) => (
          <div className="stat" key={l}><p className="l">{l}</p><p className="v">{v}</p></div>
        ))}
      </div>
      {rows.length === 0 ? <Empty /> : (
        <table className="tbl">
          <thead><tr><th>Project</th><th>Client</th><th>Status</th><th>Owner</th><th>Deadline</th><th>Budget</th><th>%</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td data-label="Project">{r.title}</td>
                <td data-label="Client">{m(r, 'client')}</td>
                <td data-label="Status"><span className={`pill ${r.status}`}>{r.status}</span></td>
                <td data-label="Owner">{m(r, 'owner')}</td>
                <td data-label="Deadline">{r.due_date ?? '—'}</td>
                <td data-label="Budget">{r.amount ? rm(r.amount) : '—'}</td>
                <td data-label="%">{r.meta?.pct != null ? `${r.meta.pct}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
