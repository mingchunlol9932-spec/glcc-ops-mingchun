'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'

type Status = {
  ok: boolean
  status: 'waiting' | 'called' | 'seated' | 'arrived' | 'no_show' | 'cancelled'
  queue_number: number
  table_number: string | null
  position: number | null
  groups_ahead: number
  wait_minutes: number
}

// Public live status page — auto-updates and alerts the customer when called.
export default function QueueStatus() {
  const params = useParams<{ id: string }>()
  const id = Array.isArray(params.id) ? params.id[0] : params.id
  const [d, setD] = useState<Status | null>(null)
  const [left, setLeft] = useState(false)
  const calledOnce = useRef(false)

  useEffect(() => {
    let stop = false
    async function poll() {
      try {
        const res = await fetch(`/api/queue/status?id=${id}`, { cache: 'no-store' })
        const j = await res.json()
        if (!stop && j.ok) {
          setD(j)
          if (j.status === 'called' && !calledOnce.current) { calledOnce.current = true; alertTurn() }
        }
      } catch { /* keep polling */ }
    }
    poll()
    const t = setInterval(poll, 4000)
    return () => { stop = true; clearInterval(t) }
  }, [id])

  function alertTurn() {
    try { navigator.vibrate?.([300, 120, 300]) } catch { /* unsupported */ }
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext
      const ctx = new Ctx()
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.type = 'sine'; o.frequency.value = 880
      g.gain.setValueAtTime(0.0001, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.05)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8)
      o.start(); o.stop(ctx.currentTime + 0.85)
    } catch { /* autoplay blocked — the visual alert still shows */ }
  }

  async function leave() {
    try {
      await fetch('/api/queue/leave', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    } catch { /* ignore */ }
    setLeft(true)
  }

  if (left) return <Frame><h1 className="qbig">You've left the queue</h1><p className="qsub">Hope to see you another time! 👋</p></Frame>
  if (!d) return <Frame><p className="qsub">Loading…</p></Frame>

  if (d.status === 'called') return (
    <Frame hot>
      <div className="qbell">🔔</div>
      <h1 className="qbig">It's your turn!</h1>
      <p className="qsub">Please head to the host — your table is ready.</p>
      <p className="qnum">#{d.queue_number}</p>
    </Frame>
  )
  if (d.status === 'seated' || d.status === 'arrived') return <Frame><h1 className="qbig">Seated 🎉</h1><p className="qsub">{d.table_number ? `Table ${d.table_number} — enjoy your meal!` : 'Enjoy your meal!'}</p></Frame>
  if (d.status === 'no_show') return <Frame><h1 className="qbig">Marked as no-show</h1><p className="qsub">Please see the host if you'd like to re-join.</p></Frame>
  if (d.status === 'cancelled') return <Frame><h1 className="qbig">You left the queue</h1></Frame>

  // waiting
  return (
    <Frame>
      <p className="qsub">Your number</p>
      <p className="qnum">#{d.queue_number}</p>
      <div className="qstats">
        <div><b>{d.position}</b><span>in line</span></div>
        <div><b>{d.groups_ahead}</b><span>ahead</span></div>
        <div><b>~{d.wait_minutes}</b><span>min wait</span></div>
      </div>
      <p className="qsub">Keep this page open — it updates by itself and alerts you when it's your turn.</p>
      <button className="qbtn ghost" onClick={leave}>Leave queue</button>
    </Frame>
  )
}

function Frame({ children, hot }: { children: React.ReactNode; hot?: boolean }) {
  return <div className={`qwrap${hot ? ' hot' : ''}`}><div className="qcard center"><div className="qbrand">🍽️ Gepuklah</div>{children}</div></div>
}
