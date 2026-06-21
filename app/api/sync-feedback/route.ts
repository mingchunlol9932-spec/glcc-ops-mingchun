import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// ============================================================
// Pull Google Business Profile reviews into records (category 'feedback').
// SCAFFOLD — works once you've completed Google setup and added these to
// .env (locally) AND Vercel → Settings → Environment Variables, then redeploy:
//
//   GOOGLE_REVIEWS_TOKEN   a valid OAuth access token (Business Profile scope)
//   GOOGLE_ACCOUNT_ID      your Business Profile account id (accounts/123...)
//   GOOGLE_LOCATION_ID     the location id for Gepuklah (locations/456...)
//
// Trigger:  GET /api/sync-feedback?secret=<CRON_SECRET>
// (or send Authorization: Bearer <CRON_SECRET>). Safe to call repeatedly —
// it upserts by Google's reviewId so reviews are never duplicated.
// ============================================================
export async function GET(req: Request) {
  const url = new URL(req.url)
  const secret = process.env.CRON_SECRET
  if (secret && url.searchParams.get('secret') !== secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const token = process.env.GOOGLE_REVIEWS_TOKEN, acct = process.env.GOOGLE_ACCOUNT_ID, loc = process.env.GOOGLE_LOCATION_ID
  if (!token || !acct || !loc) {
    return Response.json({ ok: false, error: 'Google not configured yet. Add GOOGLE_REVIEWS_TOKEN, GOOGLE_ACCOUNT_ID, GOOGLE_LOCATION_ID — see the setup checklist.' }, { status: 400 })
  }

  const STAR: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }
  let synced = 0, updated = 0
  try {
    const res = await fetch(`https://mybusiness.googleapis.com/v4/accounts/${acct}/locations/${loc}/reviews`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return Response.json({ ok: false, error: `Google API ${res.status}: ${await res.text()}` }, { status: 502 })
    const data = await res.json()
    for (const rv of (data.reviews ?? [])) {
      const meta = {
        rating: STAR[rv.starRating] ?? 0, source: 'Google',
        author: rv.reviewer?.displayName ?? 'Google user', review_id: rv.reviewId,
        url: rv.name ? `https://business.google.com/reviews` : null,
      }
      const row = { title: meta.author, status: 'new', category: 'feedback', notes: rv.comment ?? '', created_at: rv.createTime ?? new Date().toISOString(), meta }
      const { data: existing } = await supabase.from('records').select('id').eq('category', 'feedback').contains('meta', { review_id: rv.reviewId }).maybeSingle()
      if (existing) { await supabase.from('records').update({ notes: row.notes, meta }).eq('id', existing.id); updated++ }
      else { await supabase.from('records').insert(row); synced++ }
    }
  } catch (e: unknown) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'sync failed' }, { status: 500 })
  }
  return Response.json({ ok: true, synced, updated })
}
