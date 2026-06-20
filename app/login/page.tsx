'use client'

import { Suspense } from 'react'
import { useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { login, type LoginState } from './actions'

function LoginForm() {
  const params = useSearchParams()
  const next = params.get('next') ?? '/'
  const noAccess = params.get('error') === 'no-access'

  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, undefined)

  return (
    <form className="login-card" action={formAction}>
      <div className="brand">
        <span className="logo" aria-hidden="true" /> Your AI HQ
      </div>
      <h1 className="login-title">Sign in</h1>
      <p className="login-sub">Use your team email and password.</p>

      {noAccess && (
        <div className="login-err">
          Your account has no tabs enabled yet. Ask an admin to grant access.
        </div>
      )}
      {state?.error && <div className="login-err">{state.error}</div>}

      <input type="hidden" name="next" value={next} />

      <label className="login-label">
        Email
        <input
          className="login-input"
          type="email"
          name="email"
          autoComplete="email"
          required
          autoFocus
        />
      </label>
      <label className="login-label">
        Password
        <input
          className="login-input"
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </label>

      <button className="btn login-btn" type="submit" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="login-wrap">
      <Suspense fallback={<div className="login-card">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
