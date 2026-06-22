import { useState } from 'react'
import { supabase } from '../../supabase.js'

function LogoMark() {
  return (
    <svg className="auth-logomark" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="32" height="32" rx="6" fill="var(--terra)"/>
      <rect x="4"    y="20" width="7" height="8"  fill="white"/>
      <rect x="12.5" y="12" width="7" height="16" fill="white"/>
      <rect x="21"   y="4"  width="7" height="24" fill="white"/>
    </svg>
  )
}

function EyeIcon({ open }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 2l12 12M6.5 6.7A2 2 0 0110 10M1 8s2-4 7-4m3.5 1.5C13 6.8 15 8 15 8s-2.5 5-7 5a6.7 6.7 0 01-3-.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}

export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess]   = useState(false)
  const [error, setError]       = useState(null)

  const mismatch = confirm && confirm !== password

  async function handleSubmit(e) {
    e.preventDefault()
    if (!password || mismatch) return
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setSubmitting(true)
    setError(null)
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) { setError(err.message); setSubmitting(false); return }
    setSuccess(true)
    setTimeout(() => onDone(), 1500)
  }

  return (
    <div className="auth-page">
      <div className={`auth-card${success ? ' auth-card--success' : ''}`}>
        <div className="auth-card-header">
          <LogoMark />
          <h1 className="auth-heading">Set a new password</h1>
          <p className="auth-subheading">Choose a strong password for your account.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label className="auth-label" htmlFor="rp-pw">New password</label>
            <div className="auth-input-wrap">
              <input
                id="rp-pw"
                type={showPw ? 'text' : 'password'}
                className="auth-input auth-input--icon"
                value={password}
                autoFocus
                autoComplete="new-password"
                onChange={e => { setPassword(e.target.value); setError(null) }}
              />
              <button type="button" className="auth-eye" onClick={() => setShowPw(s => !s)}>
                <EyeIcon open={showPw} />
              </button>
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="rp-confirm">Confirm password</label>
            <input
              id="rp-confirm"
              type={showPw ? 'text' : 'password'}
              className={`auth-input${mismatch ? ' auth-input--error' : ''}`}
              value={confirm}
              autoComplete="new-password"
              onChange={e => setConfirm(e.target.value)}
            />
            {mismatch && <p className="auth-field-err">Passwords don't match.</p>}
          </div>

          {error && <p className="auth-login-err" role="alert">{error}</p>}

          <button
            type="submit"
            className={`btn-primary auth-submit${success ? ' auth-submit--done' : ''}`}
            disabled={submitting || success || !password || mismatch}
          >
            {success ? '✓ Password updated' : submitting ? 'Saving…' : 'Set new password →'}
          </button>
        </form>
      </div>
    </div>
  )
}
