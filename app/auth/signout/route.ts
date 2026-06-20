import { NextResponse } from 'next/server'
import { createAuthServerClient } from '@/lib/supabase/auth-server'

// Clears the Supabase session cookie, then sends the user back to /login.
export async function POST(request: Request) {
  const supabase = await createAuthServerClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
}
