import { getSimpleDashboard } from '@/lib/ops'
import { supabaseConfigured } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!supabaseConfigured) return Response.json({ ok: false, error: 'Database not connected.' }, { status: 503 })
  return Response.json({ ok: true, ...(await getSimpleDashboard()) })
}
