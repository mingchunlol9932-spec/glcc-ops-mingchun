// Static list of business-dashboard tabs. The dashboard lives under /dash so it
// never collides with the public queue at the site root. Protection is handled
// by middleware.ts (a single staff PIN cookie) — there are no per-user roles
// anymore, so this is just the nav order.

export type Tab = { href: string; label: string }

export const TABS: Tab[] = [
  { href: '/dash', label: 'Dashboard' },
  { href: '/dash/pipeline', label: 'Pipeline' },
  { href: '/dash/money', label: 'Money' },
  { href: '/dash/tasks', label: 'Tasks' },
  { href: '/dash/projects', label: 'Projects' },
  { href: '/dash/contacts', label: 'Contacts' },
  { href: '/dash/content', label: 'Content' },
  { href: '/dash/hr', label: 'HR' },
  { href: '/dash/timetable', label: 'Timetable' },
  { href: '/dash/agents', label: 'Agents' },
]
