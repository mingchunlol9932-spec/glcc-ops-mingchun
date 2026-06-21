'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// Public PIN screen for the business dashboard. Middleware redirects here with
// ?next=<the page they wanted>. A correct PIN sets the cookie via /api/dash/unlock
// and we forward them on. (useSearchParams must sit inside <Suspense> for the build.)
function UnlockForm() {
  const params = useSearchParams()
  const router = useRouter()
  const next = params.get('next') || '/dash'
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true); setErr('')
    const r = await fetch('/api/dash/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })
    const j = await r.json().catch(() => ({ ok: false }))
    setBusy(false)
    if (j.ok) router.push(next)
    else setErr('Wrong PIN — try again.')
  }

  return (
    <div className="qwrap">
      <div className="qcard center">
        <h1 className="qtitle">Gepuklah Dashboard</h1>
        <p className="qsub">Enter the staff PIN to view the business dashboard.</p>
        <input className="qpin" value={pin} onChange={e => setPin(e.target.value)}
          type="password" inputMode="numeric" placeholder="PIN"
          onKeyDown={e => { if (e.key === 'Enter') submit() }} />
        {err && <p className="qerr">{err}</p>}
        <button className="qbtn" disabled={busy} onClick={submit}>Unlock</button>
      </div>
    </div>
  )
}

export default function UnlockPage() {
  return (
    <Suspense fallback={<div className="qwrap"><div className="qcard center"><p className="qsub">Loading…</p></div></div>}>
      <UnlockForm />
    </Suspense>
  )
}
