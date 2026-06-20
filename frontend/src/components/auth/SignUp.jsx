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

function getStrength(pw) {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score
}

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Strong', 'Strong']
const STRENGTH_CLASSES = ['', 'pw-weak', 'pw-fair', 'pw-strong', 'pw-strong']

function validate(fields) {
  const errs = {}
  if (!fields.name.trim()) errs.name = 'Full name is required.'
  if (!fields.email.trim()) errs.email = 'Email is required.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) errs.email = 'Enter a valid email address.'
  if (!fields.password) errs.password = 'Password is required.'
  else if (getStrength(fields.password) < 2) errs.password = 'Choose a stronger password.'
  if (fields.password && getStrength(fields.password) >= 2) {
    if (!fields.confirm) errs.confirm = 'Please confirm your password.'
    else if (fields.confirm !== fields.password) errs.confirm = "Passwords don't match."
  }
  return errs
}

export default function SignUp({ onComplete, onLogin, signupMode }) {
  const [fields, setFields] = useState({ name: '', email: '', password: '', confirm: '' })
  const [touched, setTouched] = useState({})
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [formErr, setFormErr] = useState(null)

  const strength = getStrength(fields.password)
  const showConfirmField = strength >= 2 && fields.password.length > 0

  const allErrors = validate(fields)
  function err(f) { return touched[f] ? allErrors[f] : null }

  function update(f, v) { setFields(p => ({ ...p, [f]: v })) }
  function touch(f) { setTouched(p => ({ ...p, [f]: true })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setTouched({ name: true, email: true, password: true, confirm: true })
    if (Object.keys(validate(fields)).length > 0) return
    setSubmitting(true)
    setFormErr(null)
    const { data, error } = await supabase.auth.signUp({
      email: fields.email.trim(),
      password: fields.password,
      options: { data: { name: fields.name.trim() } },
    })
    if (error) { setFormErr(error.message); setSubmitting(false); return }
    const user = { id: data.user?.id, name: fields.name.trim(), email: fields.email.trim() }
    setSuccess(true)
    setTimeout(() => onComplete(user, signupMode), 700)
  }

  async function handleGoogle() {
    setTouched({})
    setFormErr(null)
    setGoogleLoading(true)
    await supabase.auth.signInWithOAuth({ provider: 'google' })
  }

  return (
    <div className="auth-page">
      <div className={`auth-card${success ? ' auth-card--success' : ''}`}>
        <div className="auth-card-header">
          <LogoMark />
          <h1 className="auth-heading">Create your account</h1>
          <p className="auth-subheading">Free to start — no credit card required</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label className="auth-label" htmlFor="su-name">Full name</label>
            <input
              id="su-name" type="text" className={`auth-input${err('name') ? ' auth-input--error' : ''}`}
              value={fields.name} autoComplete="name" autoFocus
              onChange={e => update('name', e.target.value)}
              onBlur={() => touch('name')}
            />
            {err('name') && <p className="auth-field-err">{err('name')}</p>}
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="su-email">Email address</label>
            <input
              id="su-email" type="email" className={`auth-input${err('email') ? ' auth-input--error' : ''}`}
              value={fields.email} autoComplete="email"
              onChange={e => update('email', e.target.value)}
              onBlur={() => touch('email')}
            />
            {err('email') && <p className="auth-field-err">{err('email')}</p>}
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="su-pw">Password</label>
            <div className="auth-input-wrap">
              <input
                id="su-pw" type={showPw ? 'text' : 'password'}
                className={`auth-input auth-input--icon${err('password') ? ' auth-input--error' : ''}`}
                value={fields.password} autoComplete="new-password"
                onChange={e => update('password', e.target.value)}
                onBlur={() => touch('password')}
              />
              <button type="button" className="auth-eye" onClick={() => setShowPw(s => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                <EyeIcon open={showPw} />
              </button>
            </div>
            {fields.password.length > 0 && (
              <div className="pw-strength">
                <div className={`pw-bar pw-bar--${strength}`}>
                  <div className={`pw-fill ${STRENGTH_CLASSES[strength]}`} style={{ width: `${(strength / 4) * 100}%` }} />
                </div>
                <span className={`pw-label ${STRENGTH_CLASSES[strength]}`}>{STRENGTH_LABELS[strength]}</span>
              </div>
            )}
            {err('password') && <p className="auth-field-err">{err('password')}</p>}
          </div>

          {showConfirmField && (
            <div className="auth-field auth-field--confirm">
              <label className="auth-label" htmlFor="su-confirm">Confirm password</label>
              <div className="auth-input-wrap">
                <input
                  id="su-confirm" type={showConfirm ? 'text' : 'password'}
                  className={`auth-input auth-input--icon${err('confirm') ? ' auth-input--error' : ''}`}
                  value={fields.confirm} autoComplete="new-password"
                  onChange={e => update('confirm', e.target.value)}
                  onBlur={() => touch('confirm')}
                />
                <button type="button" className="auth-eye" onClick={() => setShowConfirm(s => !s)} aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
              {err('confirm') && <p className="auth-field-err">{err('confirm')}</p>}
            </div>
          )}

          {formErr && <p className="auth-login-err" role="alert">{formErr}</p>}

          <button
            type="submit"
            className={`btn-primary auth-submit${success ? ' auth-submit--done' : ''}`}
            disabled={submitting || success}
          >
            {success ? '✓ Account created' : submitting ? 'Creating account…' : 'Create account →'}
          </button>
        </form>

        <div className="auth-divider"><span>or continue with</span></div>

        <div className="auth-social">
          <button className="auth-social-btn" type="button" onClick={handleGoogle} disabled={googleLoading}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M17.64 9.2a9.8 9.8 0 00-.16-1.7H9v3.22h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.5z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.34A9 9 0 009 18z" fill="#34A853"/>
              <path d="M3.96 10.71A5.41 5.41 0 013.68 9c0-.59.1-1.17.28-1.71V4.95H.96A9 9 0 000 9c0 1.45.35 2.82.96 4.05l3-2.34z" fill="#FBBC05"/>
              <path d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 00.96 4.95l3 2.34C4.67 5.16 6.66 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            {googleLoading ? 'Redirecting…' : 'Continue with Google'}
          </button>
        </div>

        <p className="auth-footer-note">
          Already have an account?{' '}
          <button className="landing-text-link" type="button" onClick={onLogin}>Log in →</button>
        </p>
      </div>
    </div>
  )
}
