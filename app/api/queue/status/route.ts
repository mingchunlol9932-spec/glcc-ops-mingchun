import { getEntry, groupsAheadCount, getAvgMinutes, ACTIVE } from '@/lib/queue'

export const dynamic = 'force-dynamic'

// Public: the customer's live status page polls this every few seconds. Kept
// deliberately light — a single-row lookup + a COUNT — so hundreds of phones
// polling at once stays cheap.
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id') ?? ''
  const entry = await getEntry(id)
  if (!entry) return Response.json({ ok: false, error: 'not_found' }, { status: 404 })

  const avg = await getAvgMinutes()
  const ahead = ACTIVE.includes(entry.status) ? await groupsAheadCount(entry) : 0

  return Response.json({
    ok: true,
    status: entry.status,
    queue_number: entry.queue_number,
    name: entry.name,
    party_size: entry.party_size,
    table_number: entry.table_number,
    position: entry.status === 'waiting' ? ahead + 1 : null,
    groups_ahead: ahead,
    wait_minutes: entry.status === 'waiting' ? ahead * avg : 0,
  })
}
