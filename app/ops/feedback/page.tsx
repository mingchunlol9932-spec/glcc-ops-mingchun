'use client'
import { useCallback, useEffect, useState } from 'react'
import { useOpsPin, opsGet } from '../_ops'

type Item = { id: number; customer: string; rating: number; source: string; comment: string; date: string; status: string; url: string | null }
type Data = { stats: { total: number; avgRating: number; unresolved: number; fiveStar: number }; items: Item[]; googleUrl: string | null }
const Card = ({ l, v }: { l: string; v: React.ReactNode }) => <div className="stat"><p className="l">{l}</p><p className="v">{v}</p></div>
const stars = (n: number) => (n > 0 ? '★'.repeat(n) + '☆'.repeat(5 - n) : '—')
const SOURCES = ['Google', 'Grab', 'Walk-in', 'Other']

export default function FeedbackPage() {
  const pin = useOpsPin()
  const [d, setD] = useState<Data | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [toast, setToast] = useState('')
  // add-feedback form
  const [showAdd, setShowAdd] = useState(false)
  const [customer, setCustomer] = useState(''); const [rating, setRating] = useState('5')
  const [source, setSource] = useState('Google'); const [comment, setComment] = useState('')
  // google link editor
  const [glink, setGlink] = useState('')

  const load = useCallback(async () => {
    const j = await opsGet('/api/ops/feedback', pin)
    if (j.ok) { setD(j); setGlink(j.googleUrl ?? '') }
  }, [pin])
  useEffect(() => { load() }, [load])
  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 3000) }

  async function post(action: string, extra: Record<string, unknown>) {
    const r = await fetch('/api/ops/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin, action, ...extra }) })
    const j = await r.json().catch(() => ({ ok: false }))
    if (!j.ok) flash(j.error || 'Failed')
    return j.ok
  }
  async function act(id: number, action: string) { setBusy(id); await post(action, { id }); await load(); setBusy(null) }
  async function addFeedback() {
    if (await post('add', { customer, rating: Number(rating), source, comment })) {
      setCustomer(''); setRating('5'); setSource('Google'); setComment(''); setShowAdd(false); flash('Added'); load()
    }
  }
  async function saveLink() { if (await post('set_google_url', { url: glink.trim() })) { flash('Saved'); load() } }

  if (!d) return <div className="ops"><p className="qsub" style={{ padding: 24 }}>Loading…</p></div>

  return (
    <div className="ops">
      <div className="qsum-h">
        <h1 className="ph2">Customer feedback</h1>
        <div className="qseatbtns">
          {d.googleUrl && <a className="qbtn sm ghost" href={d.googleUrl} target="_blank" rel="noreferrer">★ Open Google reviews ↗</a>}
          <button className="qbtn sm" onClick={() => setShowAdd(v => !v)}>{showAdd ? 'Close' : '+ Add feedback'}</button>
        </div>
      </div>

      {/* Google review link setter */}
      <div className="linkrow">
        <span className="kl">Google review link</span>
        <input value={glink} onChange={e => setGlink(e.target.value)} placeholder="https://g.page/r/…/review" />
        <button className="qbtn sm ghost" onClick={saveLink}>Save</button>
      </div>

      {/* Add feedback form */}
      {showAdd && (
        <div className="addcard">
          <div className="addgrid">
            <label className="fld">Customer<input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Name (optional)" /></label>
            <label className="fld">Rating
              <select value={rating} onChange={e => setRating(e.target.value)}>
                {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{stars(n)} ({n})</option>)}
              </select>
            </label>
            <label className="fld">Source
              <select value={source} onChange={e => setSource(e.target.value)}>{SOURCES.map(s => <option key={s}>{s}</option>)}</select>
            </label>
          </div>
          <label className="fld">Comment<input value={comment} onChange={e => setComment(e.target.value)} placeholder="What did they say?" /></label>
          <button className="qbtn" onClick={addFeedback}>Save feedback</button>
        </div>
      )}

      <div className="grid">
        <Card l="Total feedback" v={d.stats.total} />
        <Card l="Avg rating" v={<>{d.stats.avgRating || '—'}<small> ★</small></>} />
        <Card l="Unresolved" v={d.stats.unresolved} />
        <Card l="5-star" v={d.stats.fiveStar} />
      </div>

      {d.items.length === 0 ? (
        <p className="qsub">No feedback yet — add your first one with “+ Add feedback”.</p>
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
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
