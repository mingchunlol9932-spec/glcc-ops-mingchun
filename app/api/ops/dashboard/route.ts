import { getDashboard } from '@/lib/ops'
import { checkPin } from '@/lib/queue'
import { supabaseConfigured } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const pin = req.headers.get('x-queue-pin') ?? new URL(req.url).searchParams.get('pin')
  if (!checkPin(pin)) return Response.json({ ok: false, error: 'bad_pin' }, { status: 401 })
  if (!supabaseConfigured) return Response.json({ ok: false, error: 'Database not connected.' }, { status: 503 })
  return Response.json({ ok: true, ...(await getDashboard()) })
}
