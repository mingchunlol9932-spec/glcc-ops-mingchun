import Shell from '@/app/_components/Shell'
import ConnStatus from '@/app/_components/ConnStatus'
import { TABS } from '@/lib/tabs'

// Layout for the business dashboard. Access is gated by middleware.ts (a single
// staff PIN cookie) BEFORE this ever renders, so no auth logic lives here — the
// layout is just the sidebar shell + the live Supabase connection banner.
export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell conn={<ConnStatus />} tabs={TABS}>
      {children}
    </Shell>
  )
}
