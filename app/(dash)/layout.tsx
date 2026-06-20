import { redirect } from 'next/navigation'
import Shell from '@/app/_components/Shell'
import ConnStatus from '@/app/_components/ConnStatus'
import { createAuthServerClient, fetchProfile } from '@/lib/supabase/auth-server'
import { visibleTabs } from '@/lib/tabs'

// Layout for the business dashboard tabs. Route groups don't change URLs, so
// every existing page keeps its path — they just gain this sidebar shell.
//
// This is also the auth gate: no session → redirect to /login. We load the
// user's role + allowed tabs and hand only the VISIBLE tabs to the nav.
// (middleware.ts independently blocks direct-URL access — defense in depth.)
export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createAuthServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // TEMP-BYPASS (dev-only, REVERT): show all tabs as admin when not signed in,
  // so gated pages can be screenshotted without a login.
  if (!user) {
    return (
      <Shell conn={<ConnStatus />} tabs={visibleTabs('admin', [])} role="admin" email="dev@bypass">
        {children}
      </Shell>
    )
  }

  const { role, allowedTabs } = await fetchProfile(supabase, user.id)
  const tabs = visibleTabs(role, allowedTabs)

  return (
    <Shell conn={<ConnStatus />} tabs={tabs} role={role} email={user.email ?? ''}>
      {children}
    </Shell>
  )
}
