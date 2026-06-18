import { useState } from 'react'

export default function CourseForm({ onSubmit, disabled }) {
  const [weeks, setWeeks] = useState(16)
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3)
  const totalSessions = weeks * sessionsPerWeek

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit(weeks, sessionsPerWeek)
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
            disabled={disabled}
            aria-label="Total weeks"
          />
        </label>

        <span className="pace-op" aria-hidden="true">×</span>

        <label className="pace-field">
          <span className="section-label">Sessions / week</span>
          <input
            type="number" className="num-input"
            min={1} max={7} value={sessionsPerWeek}
            onChange={e => setSessionsPerWeek(Math.max(1, Math.min(7, Number(e.target.value))))}
            disabled={disabled}
            aria-label="Sessions per week"
          />
        </label>

        <span className="pace-result" aria-live="polite">= {totalSessions} sessions</span>
      </div>

      <button className="btn-primary" type="submit" disabled={disabled} style={{ width: '100%', justifyContent: 'center' }}>
        Build schedule →
      </button>
    </form>
  )
}
