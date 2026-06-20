// Single source of truth for the role-gated dashboard tabs.
//
// Both the nav (which HIDES disallowed tabs) and middleware.ts (which BLOCKS
// disallowed tabs by URL on the server) import from here, so the two
// enforcement points can never drift apart.
//
// `key` is what gets stored in profiles.allowed_tabs (text[]).

export type Tab = { href: string; label: string; key: string }

export const TABS: Tab[] = [
  { href: '/', label: 'Dashboard', key: 'dashboard' },
  { href: '/pipeline', label: 'Pipeline', key: 'pipeline' },
  { href: '/money', label: 'Money', key: 'money' },
  { href: '/tasks', label: 'Tasks', key: 'tasks' },
  { href: '/projects', label: 'Projects', key: 'projects' },
  { href: '/contacts', label: 'Contacts', key: 'contacts' },
  { href: '/content', label: 'Content', key: 'content' },
  { href: '/hr', label: 'HR', key: 'hr' },
  { href: '/timetable', label: 'Timetable', key: 'timetable' },
  { href: '/agents', label: 'Agents', key: 'agents' },
]

export const ALL_TAB_KEYS = TABS.map(t => t.key)

// Map a request pathname to the tab key it belongs to. Returns null for paths
// that aren't role-gated dashboard tabs (e.g. /queue, /api, /login).
export function tabKeyForPath(pathname: string): string | null {
  if (pathname === '/') return 'dashboard'
  const hit = TABS.find(
    t => t.href !== '/' && (pathname === t.href || pathname.startsWith(t.href + '/')),
  )
  return hit ? hit.key : null
}

// Admins see everything; members see only the tabs in their allowed_tabs.
export function canAccess(role: string, allowedTabs: string[], tabKey: string): boolean {
  if (role === 'admin') return true
  return allowedTabs.includes(tabKey)
}

export function visibleTabs(role: string, allowedTabs: string[]): Tab[] {
  if (role === 'admin') return TABS
  return TABS.filter(t => allowedTabs.includes(t.key))
}
