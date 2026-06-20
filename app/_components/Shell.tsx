'use client'
import { useState } from 'react'
import Nav from '@/app/_components/Nav'
import type { Tab } from '@/lib/tabs'

// Dashboard shell. Desktop (≥720px) is unchanged: a static sidebar + main.
// On phones the sidebar becomes an off-canvas drawer opened by the top-bar
// hamburger, with a tap-outside scrim and close-on-nav-tap. `conn` is the
// server-rendered <ConnStatus /> passed down so this client wrapper never
// imports lib/supabase. `tabs`/`role`/`email` come from the server layout,
// which has already authenticated the user and filtered the tabs by role.
export default function Shell({
  conn,
  children,
  tabs,
  role,
  email,
}: {
  conn: React.ReactNode
  children: React.ReactNode
  tabs: Tab[]
  role: string
  email: string
}) {
  const [open, setOpen] = useState(false)

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
          <div className="userbox-id">
            <span className="userbox-email" title={email}>{email}</span>
            <span className={`pill ${role === 'admin' ? 'won' : ''}`}>{role}</span>
          </div>
          <form action="/auth/signout" method="post">
            <button type="submit" className="signout">Sign out</button>
          </form>
        </div>
      </aside>

      <main className="main">{conn}{children}</main>
    </div>
  )
}
