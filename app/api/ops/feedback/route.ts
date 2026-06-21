import { supabase, supabaseConfigured } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Customer feedback lives in the shared `records` table (category = 'feedback').
// meta carries the custom fields: { rating: 1-5, source, author, review_id?, url? }.
// This route is server-only and PIN-gated — the service_role key never reaches the browser.

type Rec = { id: number; title: string; status: string; notes: string | null; created_at: string; meta: Record<string, unknown> }

async function feedbackRows(): Promise<Rec[]> {
  const { data } = await supabase.from('records').select('*').eq('category', 'feedback').order('created_at', { ascending: false })
  return (data ?? []).map((r) => ({ ...(r as Rec), meta: (r as Rec).meta ?? {} }))
}

export async function GET() {
  if (!supabaseConfigured) return Response.json({ ok: false, error: 'Database not connected.' }, { status: 503 })

  const rows = await feedbackRows()
  const ratings = rows.map(r => Number(r.meta.rating)).filter(n => n > 0)
  const stats = {
    total: rows.length,
    avgRating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : 0,
    unresolved: rows.filter(r => r.status !== 'resolved').length,
    fiveStar: rows.filter(r => Number(r.meta.rating) === 5).length,
  }
  const items = rows.map(r => ({
    id: r.id, customer: r.title, rating: Number(r.meta.rating) || 0,
    source: (r.meta.source as string) ?? '—', comment: r.notes ?? '',
    date: String((r.meta.date as string) ?? r.created_at).slice(0, 10),
    status: r.status, url: (r.meta.url as string) ?? null,
  }))
  const { data: setting } = await supabase.from('app_settings').select('value').eq('key', 'google_review_url').maybeSingle()
  return Response.json({ ok: true, stats, items, googleUrl: setting?.value ?? null })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const action = String(body.action ?? '')
  const id = Number(body.id)
  if (action === 'resolve') await supabase.from('records').update({ status: 'resolved' }).eq('id', id)
  else if (action === 'reopen') await supabase.from('records').update({ status: 'new' }).eq('id', id)
  else if (action === 'set_google_url') await supabase.from('app_settings').upsert({ key: 'google_review_url', value: String(body.url ?? ''), updated_at: new Date().toISOString() })
  else if (action === 'add') {
    const title = (String(body.customer ?? '').trim() || 'Anonymous').slice(0, 80)
    const rating = Math.max(0, Math.min(5, Math.round(Number(body.rating) || 0)))
    const source = String(body.source ?? '').trim() || 'Walk-in'
    const comment = String(body.comment ?? '').trim()
    if (!comment && !rating) return Response.json({ ok: false, error: 'Add a rating or a comment.' }, { status: 400 })
    await supabase.from('records').insert({ title, status: 'new', category: 'feedback', notes: comment || null, meta: { rating, source, author: title } })
  }
  else return Response.json({ ok: false, error: 'bad_action' }, { status: 400 })
  return Response.json({ ok: true })
}
