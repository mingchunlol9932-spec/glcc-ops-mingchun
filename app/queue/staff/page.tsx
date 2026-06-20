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

// PIN-protected staff console: call next, seat at a real table, free tables, QR.
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

  // Free tables that fit a party — suggested first; fall back to all free if none fit.
  function tablesForParty(party: number): FloorTable[] {
    const free = floor.filter(t => !t.occupied)
    const fits = free.filter(t => t.seats >= party)
    return fits.length ? fits : free
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

  const zones = Array.from(new Set(floor.map(t => t.zone)))

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
            <li key={e.id} className={`qrow ${e.status}`}>
              <div className="qrn">#{e.queue_number}</div>
              <div className="qinfo">
                <b>{e.name}</b> · party {e.party_size}
                <span className="qmeta">{e.phone ?? 'no phone'} · {e.status === 'waiting' ? `~${e.wait_minutes} min` : 'CALLED'}</span>
              </div>
              <div className="qacts">
                {e.status === 'waiting' && <button className="qbtn sm" onClick={() => act('call', e.id)}>Call</button>}
                {e.status === 'called' && seating !== e.id && (
                  <>
                    <button className="qbtn sm" onClick={() => setSeating(e.id)}>Arrive</button>
                    <button className="qbtn sm ghost" onClick={() => act('no_show', e.id)}>No-show</button>
                  </>
                )}
              </div>
              {seating === e.id && (
                <div className="qseat">
                  <div className="qseat-h">
                    Seat party of {e.party_size} at:
                    <button className="qx" onClick={() => setSeating(null)}>✕</button>
                  </div>
                  {tablesForParty(e.party_size).length === 0
                    ? <span className="qmeta">No free tables.</span>
                    : (
                      <div className="qtbtns">
                        {tablesForParty(e.party_size).map(t => (
                          <button key={t.id} className="qtbtn"
                            onClick={() => { act('arrive', e.id, { table_id: t.id }); setSeating(null) }}>
                            {t.label}<span>{t.seats}p</span>
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Floor — live table status grouped by zone */}
      <h2 className="qtitle sm qfloor-h">Floor · {freeTables} free</h2>
      <div className="qfloor">
        {zones.map(z => (
          <div key={z} className="qzone">
            <div className="qzone-l">Zone {z}</div>
            <div className="qtiles">
              {floor.filter(t => t.zone === z).map(t => (
                <div key={t.id} className={`qtile ${t.occupied ? 'occ' : 'free'}`}>
                  <div className="qtile-top"><b>{t.label}</b><span>{t.seats}p</span></div>
                  {t.occupied
                    ? <button className="qfree" onClick={() => act('free_table', undefined, { table_id: t.id })}>
                        <span className="qocc">{t.occupant}</span>Free
                      </button>
                    : <span className="qopenlbl">open</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
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
