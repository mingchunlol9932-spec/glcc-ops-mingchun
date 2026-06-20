import { getDayExport, EXPORT_COLUMNS } from '@/lib/ops'
import { checkPin } from '@/lib/queue'
import { supabaseConfigured } from '@/lib/supabase'
import { toCsv } from '@/lib/csv'

export const dynamic = 'force-dynamic'

// Staff: download a day's queue/visit records as CSV for reporting.
// ?date=YYYY-MM-DD (defaults to today, Malaysia time).
export async function GET(req: Request) {
  const url = new URL(req.url)
  const pin = req.headers.get('x-queue-pin') ?? url.searchParams.get('pin')
  if (!checkPin(pin)) return new Response('bad_pin', { status: 401 })
  if (!supabaseConfigured) return new Response('Database not connected.', { status: 503 })

  const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10) // MYT date
  const date = url.searchParams.get('date') || today
  const csv = toCsv(await getDayExport(date), EXPORT_COLUMNS)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="gepuklah-${date}.csv"`,
    },
  })
}
