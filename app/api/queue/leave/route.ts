import { getEntry, patchEntry, ACTIVE } from '@/lib/queue'

export const dynamic = 'force-dynamic'

// Public: a customer cancels their own spot.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any))
  const id = String(body.id ?? '')
  const e = await getEntry(id)
  if (!e) return Response.json({ ok: false }, { status: 404 })
  if (ACTIVE.includes(e.status)) await patchEntry(id, { status: 'cancelled' })
  return Response.json({ ok: true })
}
