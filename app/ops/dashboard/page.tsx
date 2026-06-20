'use client'
import { useCallback, useEffect, useState } from 'react'
import { useOpsPin, opsGet } from '../_ops'

type Dash = {
  live: { seatedPax: number; maxCapacity: number; availableSeats: number; waitingGroups: number; waitingPax: number; tablesSeated: number; tablesCleaning: number; tablesAvailable: number }
  metrics: { paxServed: number; groupsServed: number; avgDuration: number; medianDuration: number; fastestTurn: number | null; slowestTurn: number | null; turnoverCount: number; avgPaxPerGroup: number; seatUtilization: number; peakHour: string; lostPax: number; noShows: number; cancellations: number; noShowRate: number; queueConversion: number }
  score: { score: number; status: string; reasons: string[] }
  tablePerf: { code: string; turns: number; pax: number; avgDuration: number; occupiedMin: number }[]
}
const Card = ({ l, v }: { l: string; v: React.ReactNode }) => <div className="stat"><p className="l">{l}</p><p className="v">{v}</p></div>

export default function DashboardPage() {
  const pin = useOpsPin()
  const [d, setD] = useState<Dash | null>(null)
  const load = useCallback(async () => { const j = await opsGet('/api/ops/dashboard', pin); if (j.ok) setD(j) }, [pin])
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t) }, [load])
  if (!d) return <div className="ops"><p className="qsub" style={{ padding: 24 }}>Loading…</p></div>
  const { live: L, metrics: m, score: sc } = d
  const scoreClass = sc.status === 'Good day' ? 'good' : sc.status === 'Bad day' ? 'bad' : 'avg'

  return (
    <div className="ops">
      <h1 className="ph2">Dashboard</h1>

      <div className={`scorecard ${scoreClass}`}>
        <div className="scorebig">{sc.status}<small> · {sc.score}/100</small></div>
        <div className="scorewhy">{sc.status === 'Bad day' ? 'Watch: ' : 'Because: '}{sc.reasons.join(', ')}.</div>
      </div>

      <h2 className="sec">Live operations</h2>
      <div className="grid">
        <Card l="Seated now" v={<>{L.seatedPax}<small> / {L.maxCapacity}</small></>} />
        <Card l="Seats available" v={Math.max(0, L.availableSeats)} />
        <Card l="Waiting groups" v={L.waitingGroups} />
        <Card l="Waiting pax" v={L.waitingPax} />
        <Card l="Tables seated" v={L.tablesSeated} />
        <Card l="Tables cleaning" v={L.tablesCleaning} />
        <Card l="Tables available" v={L.tablesAvailable} />
      </div>

      <h2 className="sec">Today performance</h2>
      <div className="grid">
        <Card l="Pax served" v={m.paxServed} />
        <Card l="Groups served" v={m.groupsServed} />
        <Card l="Avg dining" v={<>{m.avgDuration}<small> min</small></>} />
        <Card l="Median dining" v={<>{m.medianDuration}<small> min</small></>} />
        <Card l="Fastest turn" v={m.fastestTurn != null ? <>{m.fastestTurn}<small> min</small></> : '—'} />
        <Card l="Slowest turn" v={m.slowestTurn != null ? <>{m.slowestTurn}<small> min</small></> : '—'} />
        <Card l="Turnover count" v={m.turnoverCount} />
        <Card l="Avg pax/group" v={m.avgPaxPerGroup} />
        <Card l="Seat utilization" v={<>{m.seatUtilization}<small> %</small></>} />
        <Card l="Peak hour" v={m.peakHour} />
        <Card l="Lost pax" v={m.lostPax} />
        <Card l="No-shows" v={m.noShows} />
        <Card l="Cancelled" v={m.cancellations} />
      </div>

      <h2 className="sec">Queue health</h2>
      <div className="grid">
        <Card l="Queue conversion" v={<>{m.queueConversion}<small> %</small></>} />
        <Card l="No-show rate" v={<>{m.noShowRate}<small> %</small></>} />
        <Card l="Lost pax" v={m.lostPax} />
        <Card l="Waiting now" v={<>{L.waitingGroups}<small> grp</small></>} />
      </div>

      <h2 className="sec">Table performance (today)</h2>
      <div className="tblwrap">
        <table className="tbl">
          <thead><tr><th>Table</th><th>Turns</th><th>Pax</th><th>Avg min</th><th>Occupied min</th></tr></thead>
          <tbody>
            {d.tablePerf.map(t => <tr key={t.code}><td>{t.code}</td><td>{t.turns}</td><td>{t.pax}</td><td>{t.avgDuration || '—'}</td><td>{t.occupiedMin}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  )
}
