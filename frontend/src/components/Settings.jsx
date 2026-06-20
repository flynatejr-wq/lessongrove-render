import { useState } from 'react'

const USER_TYPE_LABELS = { k12: 'K-12 Teacher', professor: 'College Professor', tutor: 'Tutor / Independent' }
const LEVELS = [
  { value: 'elementary', label: 'Elementary (K–5)' },
  { value: 'middle', label: 'Middle School (6–8)' },
  { value: 'high', label: 'High School (9–12)' },
  { value: 'undergraduate', label: 'Undergraduate' },
  { value: 'graduate', label: 'Graduate' },
]
const STANDARDS = [
  { value: 'common_core', label: 'US Common Core' },
  { value: 'ngss', label: 'US Next Gen Science (NGSS)' },
  { value: 'uk_national', label: 'UK National Curriculum' },
  { value: 'australian', label: 'Australian Curriculum v9' },
  { value: 'nz', label: 'NZ Curriculum' },
  { value: 'custom', label: 'Custom / institutional' },
  { value: 'none', label: 'None' },
]

export default function Settings({ profile, theme, onSave, onThemeToggle, onClearHistory, onSignOut }) {
  const [userType, setUserType] = useState(profile?.userType || 'k12')
  const [subject, setSubject] = useState(profile?.subject || '')
  const [level, setLevel] = useState(profile?.level || '')
  const [standards, setStandards] = useState(profile?.standards || '')
  const [scaffolding, setScaffolding] = useState(profile?.scaffolding || 'standard')
  const [saved, setSaved] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  function handleSave(e) {
    e.preventDefault()
    onSave({ userType, subject, level, standards, scaffolding })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="settings-page">
      <div className="settings-inner">
        <h1 className="settings-title">Settings</h1>

        <form onSubmit={handleSave} className="settings-form">

          <section className="settings-section">
            <h2 className="settings-section-title">Teaching profile</h2>

            <div className="settings-field">
              <label className="settings-label">I am a</label>
              <div className="settings-type-row">
                {Object.entries(USER_TYPE_LABELS).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`settings-type-btn${userType === id ? ' settings-type-btn--active' : ''}`}
                    onClick={() => setUserType(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-field">
              <label className="settings-label" htmlFor="settings-subject">Subject / discipline</label>
              <input
                id="settings-subject"
                className="settings-input"
                type="text"
                placeholder="e.g. Biology, World History, Calculus"
                value={subject}
                onChange={e => setSubject(e.target.value)}
              />
            </div>

            <div className="settings-row">
              <div className="settings-field">
                <label className="settings-label" htmlFor="settings-level">Student level</label>
                <select
                  id="settings-level"
                  className="settings-select"
                  value={level}
                  onChange={e => setLevel(e.target.value)}
                >
                  <option value="">Not set</option>
                  {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>

              <div className="settings-field">
                <label className="settings-label" htmlFor="settings-standards">Standards framework</label>
                <select
                  id="settings-standards"
                  className="settings-select"
                  value={standards}
                  onChange={e => setStandards(e.target.value)}
                >
                  <option value="">Not set</option>
                  {STANDARDS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
          </section>

          <section className="settings-section">
            <h2 className="settings-section-title">Generation defaults</h2>

            <div className="settings-field">
              <label className="settings-label">Default scaffolding level</label>
              <p className="settings-field-hint">Controls how much support and structure appears in generated lessons. You can override per session.</p>
              <div className="settings-scaffolding-row">
                {['light', 'standard', 'heavy'].map(s => (
                  <button
                    key={s}
                    type="button"
                    className={`settings-scaffold-btn${scaffolding === s ? ' settings-scaffold-btn--active' : ''}`}
                    onClick={() => setScaffolding(s)}
                  >
                    <span className="settings-scaffold-name">{s.charAt(0).toUpperCase() + s.slice(1)}</span>
                    <span className="settings-scaffold-desc">
                      {s === 'light' && 'More productive struggle, less hand-holding'}
                      {s === 'standard' && 'Balanced support for most learners'}
                      {s === 'heavy' && 'Maximum guidance, step-by-step structure'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="settings-section">
            <h2 className="settings-section-title">Appearance</h2>
            <div className="settings-field settings-field--row">
              <div>
                <span className="settings-label">Theme</span>
                <p className="settings-field-hint">Currently using {theme === 'dark' ? 'dark' : 'light'} mode.</p>
              </div>
              <button type="button" className="settings-theme-btn" onClick={onThemeToggle}>
                {theme === 'dark' ? '☀ Switch to light' : '☾ Switch to dark'}
              </button>
            </div>
          </section>

          <div className="settings-actions">
            <button type="submit" className="btn-primary">
              {saved ? '✓ Saved' : 'Save settings'}
            </button>
          </div>

        </form>

        <section className="settings-section settings-danger">
          <h2 className="settings-section-title settings-danger-title">Danger zone</h2>
          {!confirmClear ? (
            <button
              type="button"
              className="settings-clear-btn"
              onClick={() => setConfirmClear(true)}
            >
              Clear all lesson history
            </button>
          ) : (
            <div className="settings-confirm-row">
              <span className="settings-confirm-text">This will delete all saved lessons and history. Are you sure?</span>
              <button type="button" className="settings-clear-btn settings-clear-btn--confirm" onClick={() => { onClearHistory(); setConfirmClear(false) }}>
                Yes, clear everything
              </button>
              <button type="button" className="btn-ghost" onClick={() => setConfirmClear(false)}>Cancel</button>
            </div>
          )}
        </section>

        <section className="settings-section settings-section--danger">
          <h2 className="settings-section-title">Account</h2>
          <button type="button" className="settings-clear-btn" onClick={onSignOut}>
            Sign out
          </button>
        </section>

      </div>
    </div>
  )
}
