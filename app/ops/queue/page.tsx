'use client'
import { useCallback, useEffect, useState } from 'react'
import { useOpsPin, opsGet, opsAction } from '../_ops'

type QItem = { id: string; queue_number: number; name: string | null; party_size: number; waitMin: number; suggestion: string }
const qfmt = (n: number) => 'Q' + String(n).padStart(3, '0')

export default function QueuePage() {
  const pin = useOpsPin()
  const [queue, setQueue] = useState<QItem[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState(''); const [pax, setPax] = useState('2'); const [phone, setPhone] = useState('')
  const [toast, setToast] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const j = await opsGet('/api/ops/state', pin)
    if (j.ok) setQueue(j.queue)
    setLoading(false)
  }, [pin])
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t) }, [load])
  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 3500) }

  async function act(id: string | null, action: string, extra: Record<string, unknown>) {
    if (id) setBusyId(id)
    const r = await opsAction(pin, action, extra)
    if (!r.ok) flash(r.error || 'Something went wrong.')
    await load()
    setBusyId(null)
    return r.ok
  }
  async function add() {
    if (await act(null, 'add_queue', { name: name || null, pax: Math.max(1, Number(pax)), phone: phone || null })) {
      setName(''); setPax('2'); setPhone('')
      flash('Added to queue.')
    }
  }

  return (
    <div className="ops">
      <h1 className="ph2">Queue</h1>

      <div className="qaddrow">
        <input placeholder="Name (optional)" value={name} onChange={e => setName(e.target.value)} />
        <input type="number" min={1} placeholder="Pax" value={pax} onChange={e => setPax(e.target.value)} style={{ maxWidth: 80 }} />
        <input placeholder="Phone (optional)" value={phone} onChange={e => setPhone(e.target.value)} />
        <button className="qbtn" onClick={add}>Add walk-in</button>
      </div>

      <div className="qsum-h" style={{ marginTop: 20 }}><b>Waiting · {queue.length} group{queue.length === 1 ? '' : 's'}</b></div>

      {loading ? <p className="qsub">Loading…</p>
        : queue.length === 0 ? <p className="qsub">No one waiting right now.</p> : (
          <div className="qlist2">
            {queue.map(q => (
              <div key={q.id} className="qrow2">
                <div className="qrn">{qfmt(q.queue_number)}</div>
                <div className="qinfo"><b>{q.name || 'Walk-up'}</b> · {q.party_size} pax
                  <span className="qmeta">waiting {q.waitMin} min · suggest: {q.suggestion}</span></div>
                <div className="qacts">
                  <a className="qbtn sm" href="/ops">Seat ↗</a>
                  <button className="qbtn sm ghost" disabled={busyId === q.id}
                    onClick={() => { if (confirm(`Mark ${qfmt(q.queue_number)} as NO-SHOW?`)) act(q.id, 'no_show', { id: q.id }) }}>No-show</button>
                  <button className="qbtn sm ghost" disabled={busyId === q.id}
                    onClick={() => { if (confirm(`CANCEL ${qfmt(q.queue_number)}?`)) act(q.id, 'cancel_queue', { id: q.id }) }}>Cancel</button>
                </div>
              </div>
            ))}
          </div>
        )}

      <p className="qsub" style={{ marginTop: 16 }}>To seat a group, go to the <a className="qlink" href="/ops">Floor</a> and tap a table.</p>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
