'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Tab } from '@/lib/tabs'

// Tabs are role-filtered on the server (see app/(dash)/layout.tsx) and passed
// in, so a member never even sees a link to a tab they can't open. The /queue
// staff console and the /ops floor system have their own PIN, so they always show.
const EXTRA = [
  { href: '/queue/staff', label: 'Queue' },
  { href: '/ops', label: 'Ops' },
]

export default function Nav({ tabs, onNavigate }: { tabs: Tab[]; onNavigate?: () => void }) {
  const path = usePathname()
  const items = [...tabs.map(t => ({ href: t.href, label: t.label })), ...EXTRA]
  return (
    <nav className="nav">
      {items.map(t => (
        <Link key={t.href} href={t.href} className={path === t.href ? 'active' : ''} onClick={onNavigate}>
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
