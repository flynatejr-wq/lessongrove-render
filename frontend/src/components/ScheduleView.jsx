import { useState } from 'react'

export default function ScheduleView({ data, lessons, isGenerating, genProgress, onGenerateLessons, onViewLesson, onReset }) {
  const { filename, schedule } = data
  const { total_weeks, sessions_per_week, total_sessions, target_pages_per_session, sessions } = schedule

  const byWeek = sessions.reduce((acc, s) => {
    if (!acc[s.week_number]) acc[s.week_number] = []
    acc[s.week_number].push(s)
    return acc
  }, {})
  const weeks = Object.keys(byWeek).map(Number).sort((a, b) => a - b)

  const [openWeeks, setOpenWeeks] = useState(new Set([1]))

  function toggleWeek(w) {
    setOpenWeeks(prev => {
      const next = new Set(prev)
      next.has(w) ? next.delete(w) : next.add(w)
      return next
    })
  }

  const lessonsReady = lessons && Object.keys(lessons).length > 0
  const allGenerated = lessons && Object.keys(lessons).length === total_sessions

  return (
    <div className="schedule-view">
      <div className="schedule-header">
        <h2 className="schedule-title">{filename}</h2>
        <p className="schedule-meta">
          {total_weeks} weeks · {sessions_per_week} sessions/week · {total_sessions} sessions · ~{target_pages_per_session} pages/session
        </p>
      </div>

      {/* Lesson generation banner */}
      <div className="gen-banner">
        {!lessonsReady && !isGenerating && (
          <button className="gen-btn" onClick={onGenerateLessons}>
            Generate All Lesson Plans ↗
          </button>
        )}
        {isGenerating && genProgress && (
          <div className="gen-progress">
            <div className="gen-progress-bar">
              <div
                className="gen-progress-fill"
                style={{ width: `${(genProgress.current / genProgress.total) * 100}%` }}
              />
            </div>
            <span className="gen-progress-label">
              Generating lesson {genProgress.current} of {genProgress.total}…
            </span>
          </div>
        )}
        {allGenerated && (
          <p className="gen-done">All {total_sessions} lesson plans generated. Click any session to view.</p>
        )}
      </div>

      <div className="schedule-weeks">
        {weeks.map(w => {
          const isOpen = openWeeks.has(w)
          const weekSessions = byWeek[w]
          return (
            <div key={w} className={`week-block${isOpen ? ' week-block--open' : ''}`}>
              <div className="week-block-header" onClick={() => toggleWeek(w)}>
                <span className="week-block-title">Week {w}</span>
                <span className="week-block-count">{weekSessions.length} sessions</span>
                <span className="week-block-chevron">{isOpen ? '▲' : '▼'}</span>
              </div>
              {isOpen && (
                <div className="week-block-body">
                  {weekSessions.map(sess => {
                    const lesson = lessons?.[sess.session_number]
                    const isBeingGenerated = isGenerating && genProgress?.current === sess.session_number
                    return (
                      <div
                        key={sess.session_number}
                        className={`session-row${lesson ? ' session-row--has-lesson' : ''}${isBeingGenerated ? ' session-row--generating' : ''}`}
                        onClick={lesson ? () => onViewLesson(lesson) : undefined}
                        style={lesson ? { cursor: 'pointer' } : undefined}
                      >
                        <div className="session-label">
                          <span className="session-num">Session {sess.session_number}</span>
                          <span className="session-day">Day {sess.day_number}</span>
                        </div>
                        <div className="session-content">
                          {sess.units.length > 0 ? (
                            <>
                              <span className="session-units">
                                {sess.units.map(u => u.title).join(' · ')}
                              </span>
                              <span className="session-pages">pp. {sess.start_page}–{sess.end_page} ({sess.page_count} pp.)</span>
                            </>
                          ) : (
                            <span className="session-empty">No content assigned</span>
                          )}
                        </div>
                        <div className="session-lesson-status">
                          {lesson && <span className="lesson-ready-badge">View Lesson →</span>}
                          {isBeingGenerated && <span className="lesson-generating-badge">Generating…</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="actions">
        <button className="reset-btn" onClick={onReset}>Start Over</button>
      </div>
    </div>
  )
}
