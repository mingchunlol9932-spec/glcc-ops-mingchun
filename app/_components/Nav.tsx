'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Tab } from '@/lib/tabs'

// The business-dashboard tabs are passed in from the layout. We also pin a link
// across to the Ops floor (the live queue / table system), which has its own PIN.
const EXTRA = [
  { href: '/ops', label: '→ Ops floor' },
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
