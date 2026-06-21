import {
  seatGroup, customerLeft, markReady, markCleaning,
  cancelQueue, noShowQueue, setSetting, setTableCapacity, setQueueOpen,
} from '@/lib/ops'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const action = String(body.action ?? '')
  const str = (k: string) => (body[k] != null ? String(body[k]) : '')
  const num = (k: string) => Number(body[k]) || 0
  const ids = (k: string) => (Array.isArray(body[k]) ? (body[k] as unknown[]).map(String) : [])

  try {
    switch (action) {
      case 'seat_queue': {
        const qid = str('queue_id')
        const { data: q } = await supabase.from('queue_entries').select('party_size,name').eq('id', qid).maybeSingle()
        if (!q) return Response.json({ ok: false, error: 'Queue group not found.' }, { status: 404 })
        const v = await seatGroup({ pax: q.party_size, tableIds: ids('table_ids'), customerName: q.name, queueEntryId: qid })
        return Response.json({ ok: true, visit_id: v.id })
      }
      case 'customer_left': await customerLeft(str('visit_id')); break
      case 'mark_ready': await markReady(str('table_id')); break
      case 'mark_cleaning': await markCleaning(str('table_id')); break
      case 'cancel_queue': await cancelQueue(str('id')); break
      case 'no_show': await noShowQueue(str('id')); break
      case 'set_queue_open': await setQueueOpen(str('open') === 'true'); break
      case 'set_setting': await setSetting(str('key'), str('value')); break
      case 'set_capacity': await setTableCapacity(str('table_id'), num('seats')); break
      default: return Response.json({ ok: false, error: 'bad_action' }, { status: 400 })
    }
    return Response.json({ ok: true })
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Action failed.' }, { status: 400 })
  }
}
