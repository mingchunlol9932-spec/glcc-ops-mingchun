'use client'
import { createContext, useContext } from 'react'
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
  { href: '/ops/feedback', label: 'Feedback' },
  { href: '/ops/settings', label: 'Settings' },
  { href: '/dash', label: 'Business ↗' },
  { href: '/hr', label: 'Staff ↗' },
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

// No PIN gate — the Ops console opens directly. The pin in context is empty;
// the API routes no longer require it. (Keep the context so the page components
// can stay unchanged.)
export function OpsProvider({ children }: { children: React.ReactNode }) {
  return <Ctx.Provider value={{ pin: '' }}><OpsNav />{children}</Ctx.Provider>
}
