'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const Ctx = createContext<{ pin: string }>({ pin: '' })
export const useOpsPin = () => useContext(Ctx).pin

// Shared fetch helpers (always send the PIN).
export async function opsGet(path: string, pin: string) {
  const r = await fetch(path, { headers: { 'x-queue-pin': pin }, cache: 'no-store' })
  return r.json().catch(() => ({ ok: false }))
}
export async function opsAction(pin: string, action: string, extra: Record<string, unknown> = {}) {
  const r = await fetch('/api/ops/action', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin, action, ...extra }),
  })
  return r.json().catch(() => ({ ok: false, error: 'Network error' }))
}

const TABS = [
  { href: '/ops', label: 'Floor' },
  { href: '/ops/queue', label: 'Queue' },
  { href: '/ops/dashboard', label: 'Dashboard' },
  { href: '/ops/settings', label: 'Settings' },
]

function OpsNav() {
  const path = usePathname()
  return (
    <nav className="opsnav">
      <span className="opsbrand">🍽️ Gepuklah</span>
      <div className="opstabs">
        {TABS.map(t => (
          <Link key={t.href} href={t.href} className={path === t.href ? 'active' : ''}>{t.label}</Link>
        ))}
      </div>
    </nav>
  )
}

export function OpsProvider({ children }: { children: React.ReactNode }) {
  const [pin, setPin] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [err, setErr] = useState('')

  async function verify(p: string) {
    const r = await fetch('/api/ops/state', { headers: { 'x-queue-pin': p }, cache: 'no-store' })
    if (r.ok) { localStorage.setItem('queue_pin', p); setPin(p); setErr('') }
    else { setErr('Wrong PIN — try again.'); localStorage.removeItem('queue_pin') }
  }
  useEffect(() => { const p = localStorage.getItem('queue_pin'); if (p) verify(p) }, [])

  if (!pin) {
    return (
      <div className="qwrap">
        <div className="qcard center">
          <h1 className="qtitle">Gepuklah Ops</h1>
          <p className="qsub">Enter the staff PIN.</p>
          <input className="qpin" value={input} onChange={e => setInput(e.target.value)}
            type="password" inputMode="numeric" placeholder="PIN"
            onKeyDown={e => { if (e.key === 'Enter') verify(input) }} />
          {err && <p className="qerr">{err}</p>}
          <button className="qbtn" onClick={() => verify(input)}>Unlock</button>
        </div>
      </div>
    )
  }
  return <Ctx.Provider value={{ pin }}><OpsNav />{children}</Ctx.Provider>
}
