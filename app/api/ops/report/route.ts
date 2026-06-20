import { getReport, periodRange } from '@/lib/ops'
import { checkPin } from '@/lib/queue'
import { supabaseConfigured } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const pin = req.headers.get('x-queue-pin') ?? url.searchParams.get('pin')
  if (!checkPin(pin)) return Response.json({ ok: false, error: 'bad_pin' }, { status: 401 })
  if (!supabaseConfigured) return Response.json({ ok: false, error: 'Database not connected.' }, { status: 503 })
  const { from, to } = periodRange(
    url.searchParams.get('period') ?? 'today',
    url.searchParams.get('from') ?? undefined,
    url.searchParams.get('to') ?? undefined,
  )
  return Response.json({ ok: true, ...(await getReport(from, to)) })
}
