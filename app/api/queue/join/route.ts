import { createEntry } from '@/lib/queue'
import { supabaseConfigured } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Public: a customer joins the queue from the QR / join page.
export async function POST(req: Request) {
  if (!supabaseConfigured) {
    return Response.json({ ok: false, error: 'Queue is not set up yet — please ask staff.' }, { status: 503 })
  }
  const body = await req.json().catch(() => ({} as any))
  const name = String(body.name ?? '').trim().slice(0, 80)
  const party = Math.max(1, Math.min(99, parseInt(String(body.party_size), 10) || 1))
  const phone = String(body.phone ?? '').trim().slice(0, 30) || null
  if (!name) return Response.json({ ok: false, error: 'Please enter your name.' }, { status: 400 })
  try {
    const e = await createEntry(name, party, phone)
    return Response.json({ ok: true, id: e.id, queue_number: e.queue_number })
  } catch (err: any) {
    return Response.json({ ok: false, error: err?.message ?? 'Could not join the queue.' }, { status: 500 })
  }
}
