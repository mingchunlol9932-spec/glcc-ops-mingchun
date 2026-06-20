'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

type Entry = {
  id: string; name: string; party_size: number; phone: string | null
  status: 'waiting' | 'called'; queue_number: number; wait_minutes: number
}
type FloorTable = {
  id: string; zone: string; label: string; seats: number
  occupied: boolean; occupant: string | null
}

// Spatial position of each table on the map (left%, top%, width%, height%) —
// laid out to mirror the real floor plan: A left, C top, B middle, D bottom,
// E right, kitchen far right.
const POS: Record<string, [number, number, number, number]> = {
  A1: [1, 6, 11, 24], A2: [1, 70, 11, 24],
  C1: [15, 4, 17, 22], C2: [34, 4, 17, 22],
  B1: [15, 38, 13, 24], B3: [30, 38, 20, 24], B2: [52, 38, 13, 24],
  D1: [14, 72, 12, 22], D2: [28, 72, 12, 22], D3: [42, 72, 12, 22], D4: [56, 72, 12, 22],
  E1: [67, 8, 14, 26], E2: [67, 44, 14, 26],
}
const ZCOLOR: Record<string, string> = {
  A: '#22c55e', B: '#38bdf8', C: '#a855f7', D: '#f87171', E: '#f59e0b',
}

export default function StaffQueue() {
  const [pin, setPin] = useState('')
  const [authed, setAuthed] = useState(false)
  const [err, setErr] = useState('')
  const [active, setActive] = useState<Entry[]>([])
  const [floor, setFloor] = useState<FloorTable[]>([])
  const [freeTables, setFreeTables] = useState(0)
  const [seated, setSeated] = useState(0)
  const [seating, setSeating] = useState<string | null>(null) // entry id being seated
  const [avgInput, setAvgInput] = useState('')
  const [qr, setQr] = useState('')
  const [joinUrl, setJoinUrl] = useState('')
  const avgTouched = useRef(false)

  const load = useCallback(async (p: string): Promise<boolean> => {
    const res = await fetch('/api/queue/staff', { headers: { 'x-queue-pin': p }, cache: 'no-store' })
    if (res.status === 401) { setAuthed(false); setErr('Wrong PIN — try again.'); localStorage.removeItem('queue_pin'); return false }
    const j = await res.json().catch(() => ({}))
    if (!j.ok) return false
    setActive(j.active ?? [])
    setFloor(j.floor ?? [])
    setFreeTables(j.free_tables ?? 0)
    setSeated(j.seated_today ?? 0)
    if (!avgTouched.current) setAvgInput(String(j.avg_minutes))
    setAuthed(true); setErr('')
    return true
  }, [])

  const unlock = useCallback(async (p: string) => {
    const ok = await load(p)
    if (ok) localStorage.setItem('queue_pin', p)
  }, [load])

  useEffect(() => {
    const saved = localStorage.getItem('queue_pin')
    if (saved) { setPin(saved); unlock(saved) }
  }, [unlock])

  useEffect(() => {
    const url = `${window.location.origin}/queue`
    setJoinUrl(url)
    QRCode.toDataURL(url, { width: 240, margin: 1 }).then(setQr).catch(() => {})
  }, [])

  useEffect(() => {
    if (!authed) return
    const t = setInterval(() => load(pin), 4000)
    return () => clearInterval(t)
  }, [authed, pin, load])

  const act = useCallback(async (action: string, id?: string, extra: Record<string, unknown> = {}) => {
    await fetch('/api/queue/staff', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, action, id, ...extra }),
    })
    load(pin)
  }, [pin, load])

  const seatingEntry = active.find(e => e.id === seating) || null

  function clickTable(t: FloorTable) {
    if (seating) {
      if (t.occupied) return            // can't seat on an occupied table
      act('arrive', seating, { table_id: t.id })
      setSeating(null)
    } else if (t.occupied) {
      if (confirm(`Free ${t.label}${t.occupant ? ` (${t.occupant})` : ''}?`)) {
        act('free_table', undefined, { table_id: t.id })
      }
    }
  }

  if (!authed) {
    return (
      <div className="qwrap">
        <div className="qcard center">
          <h1 className="qtitle">Staff queue</h1>
          <p className="qsub">Enter the staff PIN.</p>
          <input className="qpin" value={pin} onChange={e => setPin(e.target.value)}
            type="password" inputMode="numeric" placeholder="PIN"
            onKeyDown={e => { if (e.key === 'Enter') unlock(pin) }} />
          {err && <p className="qerr">{err}</p>}
          <button className="qbtn" onClick={() => unlock(pin)}>Unlock</button>
        </div>
      </div>
    )
  }

  return (
    <div className="qstaff">
      <header className="qshead">
        <h1 className="qtitle">Queue console</h1>
        <a className="qlink" href="/">← AI HQ</a>
      </header>

      <div className="qsbar">
        <span><b>{active.length}</b> in line</span>
        <span><b>{freeTables}</b> tables free</span>
        <span><b>{seated}</b> seated today</span>
        <label className="qavg">avg min/table
          <input type="number" min="1" value={avgInput}
            onChange={e => { avgTouched.current = true; setAvgInput(e.target.value) }} />
          <button onClick={() => act('set_avg', undefined, { avg_minutes: Number(avgInput) })}>Save</button>
        </label>
      </div>

      {active.length === 0 ? (
        <p className="qsub">No one waiting right now.</p>
      ) : (
        <ul className="qlist">
          {active.map(e => (
            <li key={e.id} className={`qrow ${e.status}${seating === e.id ? ' seatingnow' : ''}`}>
              <div className="qrn">#{e.queue_number}</div>
              <div className="qinfo">
                <b>{e.name}</b> · party {e.party_size}
                <span className="qmeta">{e.phone ?? 'no phone'} · {e.status === 'waiting' ? `~${e.wait_minutes} min` : 'CALLED'}</span>
              </div>
              <div className="qacts">
                {e.status === 'waiting' && <button className="qbtn sm" onClick={() => act('call', e.id)}>Call</button>}
                {e.status === 'called' && (
                  seating === e.id
                    ? <button className="qbtn sm ghost" onClick={() => setSeating(null)}>Cancel</button>
                    : <>
                        <button className="qbtn sm" onClick={() => setSeating(e.id)}>Arrive</button>
                        <button className="qbtn sm ghost" onClick={() => act('no_show', e.id)}>No-show</button>
                      </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Seating instruction banner */}
      {seatingEntry && (
        <div className="qseatbar">
          <span>🪑 Seating <b>{seatingEntry.name}</b> · party {seatingEntry.party_size} — tap a glowing table</span>
          <button onClick={() => setSeating(null)}>Cancel</button>
        </div>
      )}

      {/* Visual floor map */}
      <div className="qlegend">
        <span className="qtitle sm">Floor · {freeTables} free</span>
        {Object.entries(ZCOLOR).map(([z, c]) => (
          <span key={z} className="qdot"><i style={{ background: c }} />{z}</span>
        ))}
      </div>
      <div className="qmap">
        {floor.map(t => {
          const p = POS[t.id]
          if (!p) return null
          const fits = !t.occupied && t.seats >= (seatingEntry?.party_size ?? 0)
          const cls = t.occupied
            ? `qmt occ${seating ? ' dim' : ''}`
            : `qmt${seating ? (fits ? ' seatable' : ' seatfree') : ''}`
          return (
            <div key={t.id} className={cls}
              style={{
                left: `${p[0]}%`, top: `${p[1]}%`, width: `${p[2]}%`, height: `${p[3]}%`,
                borderColor: t.occupied ? undefined : ZCOLOR[t.zone],
              }}
              onClick={() => clickTable(t)}>
              <b>{t.label}</b>
              {t.occupied
                ? <span className="nm">{t.occupant}</span>
                : <span className="s">{t.seats}p</span>}
            </div>
          )
        })}
        <div className="qkitchen" style={{ left: '83%', top: '4%', width: '15%', height: '90%' }}>
          Kitchen / Counter
        </div>
      </div>

      <div className="qqr">
        <h2 className="qtitle sm">Customer QR</h2>
        <p className="qsub">Print &amp; display this. Scanning it opens the join page.</p>
        {qr && <img src={qr} alt="Queue QR code" width={200} height={200} />}
        <p className="qurl">{joinUrl}</p>
        <button className="qbtn ghost sm" onClick={() => window.print()}>Print QR</button>
      </div>
    </div>
  )
}
