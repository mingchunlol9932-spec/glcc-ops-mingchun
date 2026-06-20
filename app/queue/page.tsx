'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Public join page — what a customer sees after scanning the QR.
export default function JoinQueue() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [party, setParty] = useState('2')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      const res = await fetch('/api/queue/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, party_size: Number(party), phone }),
      })
      const d = await res.json().catch(() => ({}))
      if (d.ok) router.push(`/queue/${d.id}`)
      else setErr(d.error || 'Could not join the queue.')
    } catch {
      setErr('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="qwrap">
      <div className="qcard">
        <h1 className="qtitle">Join the queue</h1>
        <p className="qsub">Hold your spot from anywhere — we'll show your number and wait time.</p>
        <form onSubmit={submit} className="qform">
          <label>Name
            <input value={name} onChange={e => setName(e.target.value)} required placeholder="Your name" autoFocus />
          </label>
          <label>Party size
            <input type="number" min="1" max="99" value={party} onChange={e => setParty(e.target.value)} required />
          </label>
          <label>Phone <span className="qopt">(optional)</span>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 012-3456789" />
          </label>
          {err && <p className="qerr">{err}</p>}
          <button className="qbtn" disabled={busy}>{busy ? 'Joining…' : 'Join queue'}</button>
        </form>
      </div>
    </div>
  )
}
