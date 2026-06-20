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
  // Zone C — 6 square 2-tops along the top
  C1: [15, 4, 7.5, 21], C2: [23.3, 4, 7.5, 21], C3: [31.6, 4, 7.5, 21],
  C4: [39.9, 4, 7.5, 21], C5: [48.2, 4, 7.5, 21], C6: [56.5, 4, 7.5, 21],
  // Zone B — round 4-tops + long communal 8-top
  B1: [15, 38, 13, 24], B3: [30, 38, 20, 24], B2: [52, 38, 13, 24],
  // Zone D — 8 square 2-tops along the bottom
  D1: [14, 72, 6.4, 21], D2: [21.1, 72, 6.4, 21], D3: [28.2, 72, 6.4, 21], D4: [35.3, 72, 6.4, 21],
  D5: [42.4, 72, 6.4, 21], D6: [49.5, 72, 6.4, 21], D7: [56.6, 72, 6.4, 21], D8: [63.7, 72, 6.4, 21],
  // Zone E — round 4-tops
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
  const [picked, setPicked] = useState<string[]>([])           // table ids selected to combine
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

  function startSeating(entryId: string) { setSeating(entryId); setPicked([]) }
  function cancelSeating() { setSeating(null); setPicked([]) }
  function confirmSeat() {
    if (!seating || picked.length === 0) return
    act('arrive', seating, { table_ids: picked })
    cancelSeating()
  }

  function clickTable(t: FloorTable) {
    if (seating) {
      if (t.occupied) return            // can't seat on an occupied table
      setPicked(p => p.includes(t.id) ? p.filter(x => x !== t.id) : [...p, t.id]) // toggle (combine)
    } else if (t.occupied) {
      if (confirm(`Free ${t.label}${t.occupant ? ` (${t.occupant})` : ''}? This frees the whole group.`)) {
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
                    ? <button className="qbtn sm ghost" onClick={cancelSeating}>Cancel</button>
                    : <>
                        <button className="qbtn sm" onClick={() => startSeating(e.id)}>Arrive</button>
                        <button className="qbtn sm ghost" onClick={() => act('no_show', e.id)}>No-show</button>
                      </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Seating instruction banner — pick one or more tables to combine, then Seat */}
      {seatingEntry && (() => {
        const pickedTables = floor.filter(t => picked.includes(t.id))
        const totalSeats = pickedTables.reduce((s, t) => s + t.seats, 0)
        const enough = totalSeats >= seatingEntry.party_size
        return (
          <div className="qseatbar">
            <span>🪑 <b>{seatingEntry.name}</b> · party {seatingEntry.party_size} — {
              pickedTables.length
                ? <>seat at <b>{pickedTables.map(t => t.label).join('+')}</b> ({totalSeats} seat{totalSeats !== 1 ? 's' : ''}{enough ? ' ✓' : ''})</>
                : 'tap one or more tables (combine for bigger parties)'
            }</span>
            <div className="qseatbtns">
              {pickedTables.length > 0 && <button className="go" onClick={confirmSeat}>Seat</button>}
              <button onClick={cancelSeating}>Cancel</button>
            </div>
          </div>
        )
      })()}

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
          const isPicked = picked.includes(t.id)
          const fits = !t.occupied && t.seats >= (seatingEntry?.party_size ?? 0)
          const cls = t.occupied
            ? `qmt occ${seating ? ' dim' : ''}`
            : `qmt${seating ? (isPicked ? ' picked' : (fits ? ' seatable' : ' seatfree')) : ''}`
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
