import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

// Browser/auth Supabase client — uses the PUBLISHABLE / ANON key (safe to expose)
// and stores the session in cookies. This is separate from lib/supabase.ts,
// which keeps the secret service_role key for trusted server-side data access.
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/rest\/v\d+$/i, '')
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()

// "Configured" = real, non-placeholder auth values present. Lets the login page
// show a clear message instead of cryptic errors before the keys are pasted.
export const authConfigured = Boolean(
  url && anonKey &&
    !/YOUR-PROJECT|placeholder/i.test(url) &&
    !/placeholder/i.test(anonKey),
)

// Server-side auth client bound to the request cookies. Use in Server
// Components, Server Actions, and Route Handlers.
export async function createAuthServerClient() {
  const cookieStore = await cookies()
  return createServerClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder-key', {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component, which can't write cookies. The
          // middleware refreshes the session cookie, so this is safe to ignore.
        }
      },
    },
  })
}

// Read a user's role + allowed tabs. RLS lets a user read only their own row,
// so this must be called with that user's own authenticated client.
export async function fetchProfile(
  client: SupabaseClient,
  userId: string,
): Promise<{ role: string; allowedTabs: string[] }> {
  const { data } = await client
    .from('profiles')
    .select('role, allowed_tabs')
    .eq('id', userId)
    .single()
  return {
    role: data?.role ?? 'member',
    allowedTabs: (data?.allowed_tabs ?? []) as string[],
  }
}
