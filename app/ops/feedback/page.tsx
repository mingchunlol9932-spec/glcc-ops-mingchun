'use client'
import { useCallback, useEffect, useState } from 'react'
import { useOpsPin, opsGet } from '../_ops'

type Item = { id: number; customer: string; rating: number; source: string; comment: string; date: string; status: string; url: string | null }
type Data = { stats: { total: number; avgRating: number; unresolved: number; fiveStar: number }; items: Item[]; googleUrl: string | null }
const Card = ({ l, v }: { l: string; v: React.ReactNode }) => <div className="stat"><p className="l">{l}</p><p className="v">{v}</p></div>
const stars = (n: number) => (n > 0 ? '★'.repeat(n) + '☆'.repeat(5 - n) : '—')

export default function FeedbackPage() {
  const pin = useOpsPin()
  const [d, setD] = useState<Data | null>(null)
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(async () => { const j = await opsGet('/api/ops/feedback', pin); if (j.ok) setD(j) }, [pin])
  useEffect(() => { load() }, [load])

  async function act(id: number, action: string) {
    setBusy(id)
    await fetch('/api/ops/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin, id, action }) })
    await load(); setBusy(null)
  }

  if (!d) return <div className="ops"><p className="qsub" style={{ padding: 24 }}>Loading…</p></div>

  return (
    <div className="ops">
      <div className="qsum-h">
        <h1 className="ph2">Customer feedback</h1>
        {d.googleUrl && <a className="qbtn sm" href={d.googleUrl} target="_blank" rel="noreferrer">★ Open Google reviews ↗</a>}
      </div>

      <div className="grid">
        <Card l="Total feedback" v={d.stats.total} />
        <Card l="Avg rating" v={<>{d.stats.avgRating || '—'}<small> ★</small></>} />
        <Card l="Unresolved" v={d.stats.unresolved} />
        <Card l="5-star" v={d.stats.fiveStar} />
      </div>

      {d.items.length === 0 ? (
        <p className="qsub">No feedback yet. Add rows with the SQL snippet, or wire up the Google sync.</p>
      ) : (
        <div className="tblwrap">
          <table className="tbl">
            <thead><tr><th>Customer</th><th>Rating</th><th>Source</th><th>Comment</th><th>Date</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {d.items.map(it => (
                <tr key={it.id}>
                  <td>{it.url ? <a href={it.url} target="_blank" rel="noreferrer" className="qlink">{it.customer} ↗</a> : it.customer}</td>
                  <td title={`${it.rating}/5`} style={{ color: 'var(--amber)', whiteSpace: 'nowrap' }}>{stars(it.rating)}</td>
                  <td>{it.source}</td>
                  <td style={{ maxWidth: 300 }}>{it.comment || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{it.date}</td>
                  <td><span className={`pill ${it.status === 'resolved' ? 'done' : 'open'}`}>{it.status}</span></td>
                  <td>
                    {it.status === 'resolved'
                      ? <button className="qbtn sm ghost" disabled={busy === it.id} onClick={() => act(it.id, 'reopen')}>Reopen</button>
                      : <button className="qbtn sm" disabled={busy === it.id} onClick={() => act(it.id, 'resolve')}>Resolve</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
