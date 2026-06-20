import { useState } from 'react'

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

export default function LogIn({ onComplete, onSignup }) {
  const [view, setView] = useState('login') // 'login' | 'forgot' | 'forgot-sent'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [emailTouched, setEmailTouched] = useState(false)
  const [pwTouched, setPwTouched]       = useState(false)
  const [loginErr, setLoginErr]         = useState(null)
  const [submitting, setSubmitting]     = useState(false)
  const [success, setSuccess]           = useState(false)
  const [resetEmail, setResetEmail]     = useState('')
  const [resetSubmitting, setResetSubmitting] = useState(false)

  const emailErr = emailTouched && !email.trim() ? 'Email is required.' : null
  const pwErr    = pwTouched    && !password      ? 'Password is required.' : null

  async function handleLogin(e) {
    e.preventDefault()
    setEmailTouched(true); setPwTouched(true)
    if (!email.trim() || !password) return
    setSubmitting(true); setLoginErr(null)
    await new Promise(r => setTimeout(r, 700))
    const stored = (() => { try { return JSON.parse(localStorage.getItem('lg_user')) } catch { return null } })()
    if (stored && stored.email === email.trim()) {
      setSuccess(true)
      setTimeout(() => onComplete(stored), 600)
    } else {
      setLoginErr('That email and password combination doesn\'t match. Try again or reset your password.')
      setSubmitting(false)
    }
  }

  async function handleReset(e) {
    e.preventDefault()
    if (!resetEmail.trim()) return
    setResetSubmitting(true)
    await new Promise(r => setTimeout(r, 600))
    setResetSubmitting(false)
    setView('forgot-sent')
  }

  if (view === 'forgot') {
    return (
      <div className="auth-page">
        <div className="auth-card auth-card--fade">
          <div className="auth-card-header">
            <LogoMark />
            <h1 className="auth-heading">Reset your password</h1>
          </div>
          <form className="auth-form" onSubmit={handleReset} noValidate>
            <div className="auth-field">
              <label className="auth-label" htmlFor="reset-email">Email address</label>
              <input
                id="reset-email" type="email" className="auth-input" autoFocus
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <button type="submit" className="btn-primary auth-submit" disabled={!resetEmail.trim() || resetSubmitting}>
              {resetSubmitting ? 'Sending…' : 'Send reset link →'}
            </button>
          </form>
          <p className="auth-footer-note" style={{ marginTop: 16 }}>
            <button className="landing-text-link" type="button" onClick={() => setView('login')}>← Back to log in</button>
          </p>
        </div>
      </div>
    )
  }

  if (view === 'forgot-sent') {
    return (
      <div className="auth-page">
        <div className="auth-card auth-card--fade">
          <div className="auth-card-header">
            <LogoMark />
            <h1 className="auth-heading">Check your inbox</h1>
            <p className="auth-subheading">We sent a reset link to <strong>{resetEmail}</strong></p>
          </div>
          <p className="auth-footer-note" style={{ marginTop: 24 }}>
            Didn't get it?{' '}
            <button className="landing-text-link" type="button" onClick={() => setView('forgot')}>Resend email</button>
            {' · '}
            <button className="landing-text-link" type="button" onClick={() => setView('login')}>Back to log in</button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className={`auth-card${success ? ' auth-card--success' : ''}`}>
        <div className="auth-card-header">
          <LogoMark />
          <h1 className="auth-heading">Welcome back</h1>
        </div>

        <form className="auth-form" onSubmit={handleLogin} noValidate>
          <div className="auth-field">
            <label className="auth-label" htmlFor="li-email">Email address</label>
            <input
              id="li-email" type="email" className={`auth-input${emailErr ? ' auth-input--error' : ''}`}
              value={email} autoComplete="email" autoFocus
              onChange={e => { setEmail(e.target.value); setLoginErr(null) }}
              onBlur={() => setEmailTouched(true)}
            />
            {emailErr && <p className="auth-field-err">{emailErr}</p>}
          </div>

          <div className="auth-field">
            <div className="auth-label-row">
              <label className="auth-label" htmlFor="li-pw">Password</label>
              <button type="button" className="auth-forgot-link" onClick={() => { setResetEmail(email); setView('forgot') }}>
                Forgot password?
              </button>
            </div>
            <div className="auth-input-wrap">
              <input
                id="li-pw" type={showPw ? 'text' : 'password'}
                className={`auth-input auth-input--icon${pwErr ? ' auth-input--error' : ''}`}
                value={password} autoComplete="current-password"
                onChange={e => { setPassword(e.target.value); setLoginErr(null) }}
                onBlur={() => setPwTouched(true)}
              />
              <button type="button" className="auth-eye" onClick={() => setShowPw(s => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                <EyeIcon open={showPw} />
              </button>
            </div>
            {pwErr && <p className="auth-field-err">{pwErr}</p>}
          </div>

          {loginErr && <p className="auth-login-err" role="alert">{loginErr}</p>}

          <button
            type="submit"
            className={`btn-primary auth-submit${success ? ' auth-submit--done' : ''}`}
            disabled={submitting || success}
          >
            {success ? '✓ Logged in' : submitting ? 'Logging in…' : 'Log in →'}
          </button>
        </form>

        <div className="auth-divider"><span>or continue with</span></div>

        <div className="auth-social">
          <button className="auth-social-btn" type="button" disabled>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M17.64 9.2a9.8 9.8 0 00-.16-1.7H9v3.22h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.5z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.34A9 9 0 009 18z" fill="#34A853"/>
              <path d="M3.96 10.71A5.41 5.41 0 013.68 9c0-.59.1-1.17.28-1.71V4.95H.96A9 9 0 000 9c0 1.45.35 2.82.96 4.05l3-2.34z" fill="#FBBC05"/>
              <path d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 00.96 4.95l3 2.34C4.67 5.16 6.66 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </div>

        <p className="auth-footer-note">
          Don't have an account?{' '}
          <button className="landing-text-link" type="button" onClick={onSignup}>Get started →</button>
        </p>
      </div>
    </div>
  )
}
