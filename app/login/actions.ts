'use server'

import { redirect } from 'next/navigation'
import { createAuthServerClient, authConfigured } from '@/lib/supabase/auth-server'

export type LoginState = { error: string } | undefined

// Server action: signs the user in with email + password. On success Supabase
// writes the session cookie and we redirect into the dashboard.
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const next = String(formData.get('next') ?? '/') || '/'

  if (!authConfigured) {
    return {
      error:
        'Auth isn’t configured yet — add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env, then restart.',
    }
  }
  if (!email || !password) {
    return { error: 'Enter both your email and password.' }
  }

  const supabase = await createAuthServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return { error: error.message }
  }

  // Only allow same-site relative redirects (never an attacker-supplied URL).
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/')
}
