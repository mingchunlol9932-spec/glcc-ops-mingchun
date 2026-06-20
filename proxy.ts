import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { tabKeyForPath, canAccess } from '@/lib/tabs'

// Server-side gate. This is the SECURE half of access control: hiding tabs in
// the nav is cosmetic, but this blocks direct-URL access to a tab a user isn't
// allowed to see — and bounces signed-out users to /login.
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/rest\/v\d+$/i, '')
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder-key', {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const tabKey = tabKeyForPath(path)

  // Not signed in → only protect the dashboard tabs; leave everything else alone.
  if (!user) {
    if (tabKey) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', path)
      return NextResponse.redirect(loginUrl)
    }
    return response
  }

  // Signed in: enforce per-tab access by URL.
  if (tabKey) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, allowed_tabs')
      .eq('id', user.id)
      .single()
    const role = profile?.role ?? 'member'
    const allowed = (profile?.allowed_tabs ?? []) as string[]

    if (!canAccess(role, allowed, tabKey)) {
      // Prefer bouncing them to their dashboard; if they can't even see that,
      // send them to /login with a clear message.
      if (canAccess(role, allowed, 'dashboard') && path !== '/') {
        return NextResponse.redirect(new URL('/', request.url))
      }
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('error', 'no-access')
      return NextResponse.redirect(loginUrl)
    }
  }

  return response
}

export const config = {
  // Run on app routes, but skip Next internals, the login/auth/api routes, and
  // the PIN-protected /queue console (which has its own auth).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|auth|api|queue).*)'],
}
