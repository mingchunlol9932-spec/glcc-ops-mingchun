import Shell from '@/app/_components/Shell'
import ConnStatus from '@/app/_components/ConnStatus'
import { TABS } from '@/lib/tabs'

// Layout for the business dashboard — the sidebar shell + the live Supabase
// connection banner. The dashboard is open (no PIN); it lives at an unguessable
// /dash URL under the project rather than the public root.
export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell conn={<ConnStatus />} tabs={TABS}>
      {children}
    </Shell>
  )
}
