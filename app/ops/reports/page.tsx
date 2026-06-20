'use client'
import { useCallback, useEffect, useState } from 'react'
import { useOpsPin } from '../_ops'

type Report = {
  metrics: { paxServed: number; groupsServed: number; avgDuration: number; medianDuration: number; seatUtilization: number; lostPax: number; noShows: number; cancellations: number; avgPaxPerGroup: number; peakHour: string; paxByHour: { hour: number; pax: number }[]; lostByReason: Record<string, number> }
  bestDay: { date: string; pax: number } | null
  worstDay: { date: string; pax: number } | null
  bestHour: string; worstHour: string
  tablePerf: { code: string; turns: number; pax: number; avgDuration: number }[]
}
const PERIODS = [['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'This week'], ['month', 'This month'], ['custom', 'Custom']]
const Card = ({ l, v }: { l: string; v: React.ReactNode }) => <div className="stat"><p className="l">{l}</p><p className="v">{v}</p></div>

export default function ReportsPage() {
  const pin = useOpsPin()
  const [period, setPeriod] = useState('today')
  const [from, setFrom] = useState(''); const [to, setTo] = useState('')
  const [r, setR] = useState<Report | null>(null)

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ period }); if (period === 'custom' && from && to) { qs.set('from', from); qs.set('to', to) }
    const res = await fetch(`/api/ops/report?${qs}`, { headers: { 'x-queue-pin': pin }, cache: 'no-store' })
    const j = await res.json().catch(() => ({ ok: false })); if (j.ok) setR(j)
  }, [pin, period, from, to])
  useEffect(() => { if (period !== 'custom' || (from && to)) load() }, [load, period, from, to])

  const maxHour = r ? Math.max(1, ...r.metrics.paxByHour.map(h => h.pax)) : 1

  return (
    <div className="ops">
      <h1 className="ph2">Reports</h1>
      <div className="periodbar">
        {PERIODS.map(([k, lbl]) => <button key={k} className={period === k ? 'on' : ''} onClick={() => setPeriod(k)}>{lbl}</button>)}
        {period === 'custom' && <span className="custom"><input type="date" value={from} onChange={e => setFrom(e.target.value)} /><input type="date" value={to} onChange={e => setTo(e.target.value)} /></span>}
      </div>

      {!r ? <p className="qsub">Loading…</p> : <>
        <div className="grid">
          <Card l="Pax served" v={r.metrics.paxServed} />
          <Card l="Groups served" v={r.metrics.groupsServed} />
          <Card l="Avg dining" v={<>{r.metrics.avgDuration}<small> min</small></>} />
          <Card l="Median dining" v={<>{r.metrics.medianDuration}<small> min</small></>} />
          <Card l="Seat utilization" v={<>{r.metrics.seatUtilization}<small> %</small></>} />
          <Card l="Avg pax/group" v={r.metrics.avgPaxPerGroup} />
          <Card l="Lost pax" v={r.metrics.lostPax} />
          <Card l="No-shows" v={r.metrics.noShows} />
          <Card l="Cancellations" v={r.metrics.cancellations} />
          <Card l="Best day" v={r.bestDay ? <>{r.bestDay.date}<small> · {r.bestDay.pax}p</small></> : '—'} />
          <Card l="Worst day" v={r.worstDay ? <>{r.worstDay.date}<small> · {r.worstDay.pax}p</small></> : '—'} />
          <Card l="Best hour" v={r.bestHour} />
          <Card l="Worst hour" v={r.worstHour} />
        </div>

        <h2 className="sec">Pax by hour</h2>
        <div className="bars">
          {r.metrics.paxByHour.length === 0 ? <p className="qsub">No data.</p> : r.metrics.paxByHour.map(h => (
            <div key={h.hour} className="bar"><span className="barfill" style={{ width: `${(h.pax / maxHour) * 100}%` }} /><span className="barlbl">{String(h.hour).padStart(2, '0')}:00 · {h.pax}</span></div>
          ))}
        </div>

        <h2 className="sec">Lost pax by reason</h2>
        {Object.keys(r.metrics.lostByReason).length === 0 ? <p className="qsub">No lost customers.</p> :
          <div className="grid">{Object.entries(r.metrics.lostByReason).map(([reason, pax]) => <Card key={reason} l={reason} v={pax} />)}</div>}

        <h2 className="sec">Turnover by table</h2>
        <div className="tblwrap">
          <table className="tbl">
            <thead><tr><th>Table</th><th>Turns</th><th>Pax</th><th>Avg min</th></tr></thead>
            <tbody>{r.tablePerf.map(t => <tr key={t.code}><td>{t.code}</td><td>{t.turns}</td><td>{t.pax}</td><td>{t.avgDuration || '—'}</td></tr>)}</tbody>
          </table>
        </div>
      </>}
    </div>
  )
}
