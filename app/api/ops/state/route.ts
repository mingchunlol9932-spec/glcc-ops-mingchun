import { getFloorState } from '@/lib/ops'
import { supabaseConfigured } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!supabaseConfigured) return Response.json({ ok: false, error: 'Database not connected.' }, { status: 503 })
  const state = await getFloorState()
  return Response.json({ ok: true, ...state })
}
