'use client'
import { useState } from 'react'
import Nav from '@/app/_components/Nav'
import type { Tab } from '@/lib/tabs'

// Dashboard shell. Desktop (≥720px) is a static sidebar + main; on phones the
// sidebar becomes an off-canvas drawer opened by the top-bar hamburger, with a
// tap-outside scrim and close-on-nav-tap. `conn` is the server-rendered
// <ConnStatus /> passed down so this client wrapper never imports lib/supabase.
// Access is PIN-gated by middleware — the footer button just clears that PIN.
export default function Shell({
  conn,
  children,
  tabs,
}: {
  conn: React.ReactNode
  children: React.ReactNode
  tabs: Tab[]
}) {
  const [open, setOpen] = useState(false)

  async function lock() {
    await fetch('/api/dash/unlock', { method: 'DELETE' }).catch(() => {})
    window.location.href = '/unlock?next=/dash'
  }

  return (
    <div className="app">
      {/* Mobile-only top bar (hidden ≥720px). */}
      <header className="topbar">
        <button
          className="hamburger"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <span /><span /><span />
        </button>
        <div className="brand"><span className="logo" aria-hidden="true" /> Gepuklah</div>
      </header>

      {/* Tap-outside-to-close overlay (mobile only). */}
      <div
        className={`scrim ${open ? 'show' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <aside className={`side ${open ? 'open' : ''}`}>
        <div className="brand"><span className="logo" aria-hidden="true" /> Gepuklah</div>
        <Nav tabs={tabs} onNavigate={() => setOpen(false)} />
        <div className="userbox">
          <button type="button" className="signout" onClick={lock}>🔒 Lock dashboard</button>
        </div>
      </aside>

      <main className="main">{conn}{children}</main>
    </div>
  )
}
