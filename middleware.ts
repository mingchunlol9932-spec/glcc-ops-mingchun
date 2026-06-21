import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Gate the business dashboard (/dash/*) behind the staff PIN. The PIN is stored
// in an httpOnly cookie set by /api/dash/unlock after a correct entry. We check
// it here — BEFORE any server component runs — so the records/money/HR data is
// never rendered for someone who hasn't unlocked. The public queue (/queue),
// the Ops floor (/ops, which has its own PIN), and everything else are untouched.
export function middleware(req: NextRequest) {
  const pin = req.cookies.get('dash_pin')?.value
  const expected = process.env.QUEUE_STAFF_PIN || ''
  if (expected && pin === expected) return NextResponse.next()

  const url = new URL('/unlock', req.url)
  url.searchParams.set('next', req.nextUrl.pathname)
  return NextResponse.redirect(url)
}

export const config = { matcher: ['/dash/:path*'] }
