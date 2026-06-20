'use client'
import { useCallback, useEffect, useState } from 'react'
import { useOpsPin, opsGet, opsAction } from '../_ops'

type QItem = { id: string; queue_number: number; name: string | null; party_size: number; waitMin: number; suggestion: string }
const qfmt = (n: number) => 'Q' + String(n).padStart(3, '0')
const REASONS = ['Wait too long', 'No table available', 'Group too big', 'Cancelled', 'No show', 'Other']

export default function QueuePage() {
  const pin = useOpsPin()
  const [queue, setQueue] = useState<QItem[]>([])
  const [name, setName] = useState(''); const [pax, setPax] = useState('2'); const [phone, setPhone] = useState(''); const [notes, setNotes] = useState('')
  const [toast, setToast] = useState('')
  const [lost, setLost] = useState<{ id: string | null; pax: number } | null>(null)
  const [lreason, setLreason] = useState(REASONS[0]); const [lnote, setLnote] = useState('')

  const load = useCallback(async () => { const j = await opsGet('/api/ops/state', pin); if (j.ok) setQueue(j.queue) }, [pin])
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t) }, [load])
  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 3500) }
  async function act(action: string, extra: Record<string, unknown>) {
    const r = await opsAction(pin, action, extra); if (!r.ok) flash(r.error || 'Failed'); await load(); return r.ok
  }
  async function add() {
    if (await act('add_queue', { name: name || null, pax: Math.max(1, Number(pax)), phone: phone || null, notes: notes || null })) {
      setName(''); setPax('2'); setPhone(''); setNotes('')
    }
  }

  return (
    <div className="ops">
      <h1 className="ph2">Queue</h1>
      <div className="qaddrow">
        <input placeholder="Name (optional)" value={name} onChange={e => setName(e.target.value)} />
        <input type="number" min={1} placeholder="Pax" value={pax} onChange={e => setPax(e.target.value)} style={{ maxWidth: 80 }} />
        <input placeholder="Phone (optional)" value={phone} onChange={e => setPhone(e.target.value)} />
        <input placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
        <button className="qbtn" onClick={add}>Add to queue</button>
      </div>

      <div className="qsum-h" style={{ marginTop: 20 }}><b>Waiting · {queue.length} groups</b>
        <button className="qbtn ghost sm" onClick={() => setLost({ id: null, pax: 2 })}>Lost customer</button>
      </div>
      {queue.length === 0 ? <p className="qsub">No one waiting right now.</p> : (
        <div className="qlist2">
          {queue.map(q => (
            <div key={q.id} className="qrow2">
              <div className="qrn">{qfmt(q.queue_number)}</div>
              <div className="qinfo"><b>{q.name || 'Walk-up'}</b> · {q.party_size} pax
                <span className="qmeta">waiting {q.waitMin} min · suggest: {q.suggestion}</span></div>
              <div className="qacts">
                <a className="qbtn sm" href="/ops">Seat ↗</a>
                <button className="qbtn sm ghost" onClick={() => act('no_show', { id: q.id })}>No-show</button>
                <button className="qbtn sm ghost" onClick={() => act('cancel_queue', { id: q.id })}>Cancel</button>
                <button className="qbtn sm ghost" onClick={() => setLost({ id: q.id, pax: q.party_size })}>Lost</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="qsub" style={{ marginTop: 16 }}>To seat a group, go to the <a className="qlink" href="/ops">Floor</a> and tap a table — or use the group&apos;s “Seat” there.</p>

      {lost && (
        <div className="scrim2" onClick={() => setLost(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-h"><b>Lost customer</b><button className="qx" onClick={() => setLost(null)}>✕</button></div>
            <label className="fld">Pax<input type="number" min={1} value={lost.pax} onChange={e => setLost({ ...lost, pax: Number(e.target.value) })} /></label>
            <label className="fld">Reason
              <select value={lreason} onChange={e => setLreason(e.target.value)}>{REASONS.map(r => <option key={r}>{r}</option>)}</select>
            </label>
            <label className="fld">Note (optional)<input value={lnote} onChange={e => setLnote(e.target.value)} /></label>
            <button className="qbtn wfull" onClick={async () => { await act('lost', { queue_id: lost.id, pax: Math.max(1, lost.pax), reason: lreason, note: lnote || null }); setLost(null); setLnote('') }}>Save lost customer</button>
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
