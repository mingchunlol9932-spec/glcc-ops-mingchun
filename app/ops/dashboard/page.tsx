'use client'
import { useCallback, useEffect, useState } from 'react'
import { useOpsPin, opsGet, opsAction } from '../_ops'

type Dash = {
  queueOpen: boolean
  maxCapacity: number
  waitingPax: number
  seatedPax: number
  avgWaitMinutes: number
  avgTableMinutes: number
  completedToday: number
  noShowsToday: number
  cancelledToday: number
}
const Card = ({ l, v }: { l: string; v: React.ReactNode }) => <div className="stat"><p className="l">{l}</p><p className="v">{v}</p></div>
const todayStr = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10)

export default function DashboardPage() {
  const pin = useOpsPin()
  const [d, setD] = useState<Dash | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const j = await opsGet('/api/ops/dashboard', pin)
    if (j.ok) { setD(j); setErr('') } else setErr(j.error || 'Could not load dashboard.')
  }, [pin])
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t) }, [load])

  async function toggleQueue() {
    if (!d) return
    const opening = !d.queueOpen
    if (!opening && !confirm('Close the queue? Customers will not be able to join until you re-open it.')) return
    setBusy(true)
    const r = await opsAction(pin, 'set_queue_open', { open: opening ? 'true' : 'false' })
    setBusy(false)
    if (!r.ok) setErr(r.error || 'Could not change queue state.')
    load()
  }

  if (err && !d) return <div className="ops"><div className="banner">{err}</div></div>
  if (!d) return <div className="ops"><p className="qsub" style={{ padding: 24 }}>Loading…</p></div>

  return (
    <div className="ops">
      <h1 className="ph2">Dashboard</h1>

      <div className={`scorecard ${d.queueOpen ? 'good' : 'bad'}`}>
        <div className="scorebig">Queue is {d.queueOpen ? 'OPEN' : 'CLOSED'}</div>
        <button className="qbtn" disabled={busy} onClick={toggleQueue}>
          {busy ? '…' : d.queueOpen ? 'Close queue' : 'Open queue'}
        </button>
      </div>

      <h2 className="sec">Right now</h2>
      <div className="grid">
        <Card l="Waiting pax" v={d.waitingPax} />
        <Card l="Seated pax" v={<>{d.seatedPax}<small> / {d.maxCapacity}</small></>} />
        <Card l="Avg wait" v={<>{d.avgWaitMinutes}<small> min</small></>} />
        <Card l="Avg table time" v={<>{d.avgTableMinutes}<small> min</small></>} />
      </div>

      <h2 className="sec">Today</h2>
      <div className="grid">
        <Card l="Completed tables" v={d.completedToday} />
        <Card l="No-shows" v={d.noShowsToday} />
        <Card l="Cancelled" v={d.cancelledToday} />
      </div>

      <h2 className="sec">Export</h2>
      <a className="qbtn sm" href={`/api/ops/export?date=${todayStr()}&pin=${encodeURIComponent(pin)}`}>⬇ Download today&apos;s CSV</a>

      {err && <div className="banner" style={{ marginTop: 16 }}>{err}</div>}
    </div>
  )
}
