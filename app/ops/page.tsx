'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useOpsPin, opsGet, opsAction } from './_ops'

type Shape = 'sq' | 'ci' | 're'
const POS: Record<string, [number, number, number, Shape]> = {
  A1: [2, 8, 9, 'sq'], A2: [2, 70, 9, 'sq'],
  C1: [15, 4, 8, 'sq'], C2: [15, 20, 8, 'sq'], C3: [26, 4, 8, 'sq'], C4: [26, 20, 8, 'sq'], C5: [37, 4, 8, 'sq'], C6: [37, 20, 8, 'sq'],
  B1: [15, 42, 13, 'ci'], B3: [31, 46, 18, 're'], B2: [52, 42, 13, 'ci'],
  D1: [14, 75, 6.5, 'sq'], D2: [21, 75, 6.5, 'sq'], D3: [28, 75, 6.5, 'sq'], D4: [35, 75, 6.5, 'sq'],
  D5: [42, 75, 6.5, 'sq'], D6: [49, 75, 6.5, 'sq'], D7: [56, 75, 6.5, 'sq'], D8: [63, 75, 6.5, 'sq'],
  E1: [67, 8, 13, 'ci'], E2: [67, 44, 13, 'ci'],
}
const ZCOLOR: Record<string, string> = { A: '#22c55e', B: '#38bdf8', C: '#a855f7', D: '#f87171', E: '#f59e0b' }

type FloorTable = {
  id: string; zone: string; label: string; seats: number; status: string
  cleaningMin: number | null
  visit: null | { id: string; pax: number; seated_at: string; minutes: number; customer: string | null; queue_number: number | null }
}
type QItem = { id: string; queue_number: number; name: string | null; party_size: number; waitMin: number; suggestion: string }
type State = {
  settings: { allow_split_tables: boolean }
  tables: FloorTable[]
  kpi: { seatedPax: number; maxCapacity: number; availableSeats: number; waitingGroups: number; waitingPax: number; tablesCleaning: number; targetDuration: number }
  queue: QItem[]
  nextAction: { type: string; text: string }
}
const qfmt = (n: number) => 'Q' + String(n).padStart(3, '0')

export default function FloorPage() {
  const pin = useOpsPin()
  const [d, setD] = useState<State | null>(null)
  const [avg, setAvg] = useState('')
  const avgTouched = useRef(false)
  // Everyone is in the one queue (they join by scanning the QR). Seating always
  // picks a waiting guest and assigns table(s) — no separate "walk-in" path.
  const [seating, setSeating] = useState<{ pax: number; name: string | null; queueId: string } | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [seatModal, setSeatModal] = useState<{ tableId: string | null } | null>(null)
  const [detail, setDetail] = useState<FloorTable | null>(null)
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    const j = await opsGet('/api/ops/state', pin)
    if (j.ok) { setD(j); if (!avgTouched.current) setAvg(String(j.kpi.targetDuration)) }
  }, [pin])
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t) }, [load])
  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 4000) }

  async function act(action: string, extra: Record<string, unknown>) {
    const r = await opsAction(pin, action, extra)
    if (!r.ok) { flash(r.error || 'Action failed'); return false }
    await load(); return true
  }
  async function doSeat(tableIds: string[], queueId: string) {
    const ok = await act('seat_queue', { queue_id: queueId, table_ids: tableIds })
    if (ok) { setSeating(null); setPicked([]); setSeatModal(null); setDetail(null) }
  }

  if (!d) return <div className="ops"><p className="qsub" style={{ padding: 24 }}>Loading…</p></div>
  const k = d.kpi
  const splitOk = d.settings.allow_split_tables

  function clickTable(t: FloorTable) {
    if (seating) { if (t.status === 'available') setPicked(p => p.includes(t.id) ? p.filter(x => x !== t.id) : [...p, t.id]); return }
    if (t.status === 'available') setSeatModal({ tableId: t.id })
    else setDetail(t)
  }
  // Start seating a waiting guest. If a single chosen table fits, seat right away;
  // otherwise enter "pick table(s)" mode to combine.
  function beginSeat(pax: number, name: string | null, queueId: string, fromTableId: string | null) {
    const table = fromTableId ? d!.tables.find(t => t.id === fromTableId) : null
    if (table && pax <= table.seats) { doSeat([table.id], queueId); return }
    if (table && !splitOk) { flash(`This table only has ${table.seats} seats.`); return }
    setSeating({ pax, name, queueId }); setPicked(table ? [table.id] : []); setSeatModal(null)
  }

  const pickedTables = d.tables.filter(t => picked.includes(t.id))
  const pickedSeats = pickedTables.reduce((s, t) => s + t.seats, 0)

  return (
    <div className={seating ? 'ops seatpad' : 'ops'}>
      {/* KPI bar */}
      <div className="kpis">
        <div className="kpi"><span className="kl">In line</span><span className="kv">{k.waitingGroups}<small> grp</small> / {k.waitingPax}<small> pax</small></span></div>
        <div className="kpi"><span className="kl">Seated now</span><span className="kv">{k.seatedPax}<small> / {k.maxCapacity}</small></span></div>
        <div className={`kpi ${k.availableSeats <= 6 ? 'warnkpi' : ''}`}><span className="kl">Seats available</span><span className="kv">{Math.max(0, k.availableSeats)}</span></div>
        <div className="kpi"><span className="kl">Avg min/table</span>
          <span className="kv"><input className="avgin" type="number" min={1} value={avg}
            onChange={e => { avgTouched.current = true; setAvg(e.target.value) }}
            onBlur={() => act('set_setting', { key: 'target_average_duration', value: String(Number(avg) || 45) })} /></span>
        </div>
      </div>

      {/* Next best action */}
      <div className={`nba ${d.nextAction.type}`}>
        <span className="nbal">Next best action</span>
        <span className="nbat">{d.nextAction.text}</span>
      </div>

      <div className="floorgrid">
        {/* Queue summary */}
        <aside className="qsum">
          <div className="qsum-h"><b>Waiting</b><a className="qlink" href="/ops/queue">Manage →</a></div>
          {d.queue.length === 0 ? <p className="qsub">No one waiting. Guests join by scanning the QR code.</p> : d.queue.map(q => (
            <div key={q.id} className="qsi">
              <div><b>{qfmt(q.queue_number)}</b> · {q.party_size} pax <span className="qmeta">{q.name || ''} · {q.waitMin}m · {q.suggestion}</span></div>
              <button className="qbtn sm" onClick={() => beginSeat(q.party_size, q.name, q.id, null)}>Seat</button>
            </div>
          ))}
        </aside>

        {/* Floor map */}
        <div className="qmap">
          {d.tables.map(t => {
            const p = POS[t.id]; if (!p) return null
            const target = k.targetDuration
            const min = t.visit?.minutes ?? 0
            const fits = t.status === 'available' && t.seats >= (seating?.pax ?? 0)
            let cls = `qmt ${p[3]}`
            if (t.status === 'available') cls += ' avail' + (seating ? (picked.includes(t.id) ? ' picked' : (fits ? ' seatable' : ' seatfree')) : '')
            else if (t.status === 'seated') cls += ' seated' + (min > target ? ' danger' : min >= target * 0.8 ? ' warn' : '') + (seating ? ' dim' : '')
            else if (t.status === 'cleaning') cls += ' cleaning' + (seating ? ' dim' : '')
            const border = t.status === 'available' && !picked.includes(t.id) ? ZCOLOR[t.zone] : undefined
            return (
              <div key={t.id} className={cls} style={{ left: `${p[0]}%`, top: `${p[1]}%`, width: `${p[2]}%`, borderColor: border }} onClick={() => clickTable(t)}>
                <b>{t.label}</b>
                {t.status === 'available' && <span className="s">{t.seats} seat{t.seats !== 1 ? 's' : ''}</span>}
                {t.status === 'seated' && t.visit && <><span className="s">{t.visit.pax} pax</span><span className="tmin">{min}m</span>{t.visit.queue_number && <span className="qn">{qfmt(t.visit.queue_number)}</span>}</>}
                {t.status === 'cleaning' && <><span className="s">Cleaning</span><span className="tmin">{t.cleaningMin}m</span></>}
              </div>
            )
          })}
          <div className="qkitchen" style={{ left: '83%', top: '4%', width: '15%', height: '90%' }}>Kitchen / Counter</div>
        </div>
      </div>

      {/* Seating banner */}
      {seating && (
        <div className="qseatbar floatbar">
          <span>🪑 {seating.name ? <b>{seating.name}</b> : ''} {seating.pax} pax — pick table(s): <b>{pickedTables.map(t => t.label).join('+') || '—'}</b> ({pickedSeats}/{seating.pax}{pickedSeats >= seating.pax ? ' ✓' : ''})</span>
          <div className="qseatbtns">
            {picked.length > 0 && <button className="qbtn go sm" onClick={() => doSeat(picked, seating.queueId)}>Seat</button>}
            <button className="qbtn sm" onClick={() => { setSeating(null); setPicked([]) }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Seat modal — pick a waiting guest to seat at the chosen table */}
      {seatModal && (
        <Modal onClose={() => setSeatModal(null)} title={seatModal.tableId ? `Seat at ${d.tables.find(t => t.id === seatModal.tableId)?.label}` : 'Seat next guest'}>
          {d.queue.length === 0
            ? <p className="qsub">No one waiting. Guests join by scanning the QR code.</p>
            : <div className="qpick">{d.queue.map(q => (
              <button key={q.id} className="qpickrow" onClick={() => beginSeat(q.party_size, q.name, q.id, seatModal.tableId)}>
                <b>{qfmt(q.queue_number)}</b> · {q.party_size} pax <span className="qmeta">{q.name || ''}</span>
              </button>
            ))}</div>}
        </Modal>
      )}

      {/* Seated / cleaning detail modal */}
      {detail && (
        <Modal onClose={() => setDetail(null)} title={detail.label}>
          {detail.status === 'seated' && detail.visit ? (
            <>
              <p className="dl"><span>Pax</span><b>{detail.visit.pax}</b></p>
              <p className="dl"><span>Seated at</span><b>{new Date(detail.visit.seated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b></p>
              <p className="dl"><span>Duration</span><b className={detail.visit.minutes > k.targetDuration ? 'over' : ''}>{detail.visit.minutes} min</b></p>
              {detail.visit.queue_number && <p className="dl"><span>Queue</span><b>{qfmt(detail.visit.queue_number)}</b></p>}
              <button className="qbtn wfull" onClick={() => { if (confirm('Mark this table completed? The timer stops and the table is freed.')) act('customer_left', { visit_id: detail.visit!.id }).then(ok => ok && setDetail(null)) }}>Customer left (complete)</button>
            </>
          ) : (
            <>
              <p className="dl"><span>Status</span><b>Cleaning · {detail.cleaningMin} min</b></p>
              <button className="qbtn wfull" onClick={() => act('mark_ready', { table_id: detail.id }).then(ok => ok && setDetail(null))}>Mark ready</button>
            </>
          )}
        </Modal>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="scrim2" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-h"><b>{title}</b><button className="qx" onClick={onClose}>✕</button></div>
        {children}
      </div>
    </div>
  )
}
