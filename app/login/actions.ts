'use server'

import { redirect } from 'next/navigation'
import { createAuthServerClient, authConfigured } from '@/lib/supabase/auth-server'
import { supabase as adminDb, supabaseConfigured } from '@/lib/supabase'

export type LoginState = { error: string } | undefined

// Does an auth account exist for this email? Uses the service_role admin API.
// This is an internal team tool, so we accept the small user-enumeration
// tradeoff in exchange for a clearer "no account" vs "wrong password" message.
// Returns null if we couldn't check (then we fall back to a generic message).
async function emailExists(email: string): Promise<boolean | null> {
  if (!supabaseConfigured) return null
  try {
    const { data, error } = await adminDb.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (error) return null
    const target = email.toLowerCase()
    return data.users.some(u => u.email?.toLowerCase() === target)
  } catch {
    return null
  }
}

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

  const authClient = await createAuthServerClient()
  const { error } = await authClient.auth.signInWithPassword({ email, password })
  if (error) {
    // Supabase returns ONE generic message ("Invalid login credentials") for
    // both an unknown email and a wrong password. Split it for clearer feedback.
    if (/invalid login credentials/i.test(error.message)) {
      const exists = await emailExists(email)
      if (exists === false) return { error: 'No account found with that email.' }
      if (exists === true) return { error: 'Wrong password for that email.' }
      return { error: 'Invalid email or password.' } // couldn't check — stay generic
    }
    if (/email not confirmed/i.test(error.message)) {
      return {
        error: 'That account’s email isn’t confirmed yet — confirm it in Supabase → Authentication → Users.',
      }
    }
    return { error: error.message }
  }

  // Only allow same-site relative redirects (never an attacker-supplied URL).
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/')
}
