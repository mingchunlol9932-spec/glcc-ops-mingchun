import { checkPin } from '@/lib/queue'

export const dynamic = 'force-dynamic'

// POST { pin } — if the PIN is correct, set the dashboard cookie that middleware
// checks. DELETE — clear it (the "Lock dashboard" button). The cookie stores the
// PIN itself (a single low-stakes shared secret, same as the Ops PIN) and is
// httpOnly so page scripts can't read it.
const COOKIE = 'dash_pin'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const pin = body.pin as string
  if (!checkPin(pin)) {
    return Response.json({ ok: false, error: 'bad_pin' }, { status: 401 })
  }
  const res = Response.json({ ok: true })
  res.headers.append(
    'Set-Cookie',
    `${COOKIE}=${encodeURIComponent(pin)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
  )
  return res
}

export async function DELETE() {
  const res = Response.json({ ok: true })
  res.headers.append('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
  return res
}
