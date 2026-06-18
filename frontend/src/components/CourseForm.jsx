import { useState } from 'react'

export default function CourseForm({ onSubmit, disabled, defaultScaffolding = 'standard' }) {
  const [weeks, setWeeks] = useState(16)
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3)
  const [scaffolding, setScaffolding] = useState(defaultScaffolding)
  const [termStart, setTermStart] = useState('')
  const [holidays, setHolidays] = useState('')
  const totalSessions = weeks * sessionsPerWeek

  function handleSubmit(e) {
    e.preventDefault()
    const holidayList = holidays
      .split(',')
      .map(d => d.trim())
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    onSubmit(weeks, sessionsPerWeek, scaffolding, null, termStart || null, holidayList)
  }

  return (
    <form className="pace-card" onSubmit={handleSubmit}>
      <h2 className="pace-card-title">Set term length</h2>
      <p className="pace-card-sub">
        LessonGrove will spread the textbook across {totalSessions} session{totalSessions !== 1 ? 's' : ''}, respecting chapter boundaries.
      </p>

      <div className="pace-fields">
        <label className="pace-field">
          <span className="section-label">Total weeks</span>
          <input
            type="number" className="num-input"
            min={1} max={52} value={weeks}
            onChange={e => setWeeks(Math.max(1, Math.min(52, Number(e.target.value))))}
            disabled={disabled} aria-label="Total weeks"
          />
        </label>
        <span className="pace-op" aria-hidden="true">×</span>
        <label className="pace-field">
          <span className="section-label">Sessions / week</span>
          <input
            type="number" className="num-input"
            min={1} max={7} value={sessionsPerWeek}
            onChange={e => setSessionsPerWeek(Math.max(1, Math.min(7, Number(e.target.value))))}
            disabled={disabled} aria-label="Sessions per week"
          />
        </label>
        <span className="pace-result" aria-live="polite">= {totalSessions} sessions</span>
      </div>

      {/* Scaffolding dial */}
      <div className="pace-section">
        <span className="section-label">Support level</span>
        <div className="scaffold-dial" role="group" aria-label="Scaffolding level">
          {[
            { value: 'light',    label: 'Light',    desc: 'Challenge-first, open inquiry' },
            { value: 'standard', label: 'Standard', desc: 'Balanced support and practice' },
            { value: 'heavy',    label: 'Heavy',    desc: 'Step-by-step, worked examples' },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`scaffold-btn${scaffolding === opt.value ? ' scaffold-btn--active' : ''}`}
              onClick={() => setScaffolding(opt.value)}
              disabled={disabled}
              title={opt.desc}
              aria-pressed={scaffolding === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="pace-hint">
          {scaffolding === 'light' && 'Open-ended inquiry, minimal scaffolding.'}
          {scaffolding === 'standard' && 'Balanced mix of guided and independent work.'}
          {scaffolding === 'heavy' && 'Step-by-step instruction with worked examples.'}
        </p>
      </div>

      {/* Optional: term start date */}
      <div className="pace-section">
        <label className="section-label" htmlFor="term-start">Term start date <span className="pace-optional">(optional)</span></label>
        <input
          id="term-start"
          type="date"
          className="date-input"
          value={termStart}
          onChange={e => setTermStart(e.target.value)}
          disabled={disabled}
          aria-label="Term start date"
        />
        <p className="pace-hint">If set, each session will show its real calendar date.</p>
      </div>

      {/* Holidays */}
      {termStart && (
        <div className="pace-section">
          <label className="section-label" htmlFor="holidays">School holidays <span className="pace-optional">(optional)</span></label>
          <input
            id="holidays"
            type="text"
            className="date-input"
            value={holidays}
            onChange={e => setHolidays(e.target.value)}
            disabled={disabled}
            placeholder="2025-12-25, 2026-01-01"
            aria-label="Holiday dates, comma-separated YYYY-MM-DD"
          />
          <p className="pace-hint">Comma-separated dates (YYYY-MM-DD). Sessions shift past these days.</p>
        </div>
      )}

      <button className="btn-primary" type="submit" disabled={disabled} style={{ width: '100%', justifyContent: 'center' }}>
        Build schedule →
      </button>
    </form>
  )
}
