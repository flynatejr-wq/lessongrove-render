export default function ScheduleGrid({
  data, lessons, isGenerating, genProgress,
  onGenerateLessons, onViewLesson, onReset, error,
}) {
  const { filename, schedule } = data
  const { total_weeks, sessions_per_week, total_sessions, sessions } = schedule

  // Group sessions by week
  const byWeek = {}
  for (const slot of sessions) {
    if (!byWeek[slot.week_number]) byWeek[slot.week_number] = {}
    byWeek[slot.week_number][slot.day_number] = slot
  }

  const doneCount = Object.keys(lessons).length
  const progressPct = genProgress
    ? Math.round((genProgress.current / genProgress.total) * 100)
    : doneCount > 0 ? Math.round((doneCount / total_sessions) * 100) : 0

  const dayLabel = d => sessions_per_week === 5
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][d - 1] ?? `Day ${d}`
    : `Day ${d}`

  // Collect all day numbers actually used
  const dayNums = [...new Set(sessions.map(s => s.day_number))].sort((a, b) => a - b)

  // grid-template-columns: week-label + one col per day
  const gridCols = `64px repeat(${dayNums.length}, minmax(130px, 1fr))`

  return (
    <div className="schedule-step">
      <div className="step-header">
        <p className="step-kicker">Step 3 of 3</p>
        <h2 className="step-title">Your curriculum schedule</h2>
        <p className="step-sub">
          {filename} · {total_weeks} weeks · {sessions_per_week} session{sessions_per_week !== 1 ? 's' : ''} per week · {total_sessions} total
        </p>
      </div>

      <div className="schedule-controls">
        {doneCount < total_sessions && !isGenerating && (
          <button className="btn-primary" onClick={onGenerateLessons}>
            {doneCount > 0 ? `Generate remaining (${total_sessions - doneCount})` : 'Generate all lesson plans'} →
          </button>
        )}

        {isGenerating && genProgress && (
          <div className="gen-btn-wrap">
            <div className="spinner-sm" aria-hidden="true" />
            <div className="gen-progress-track" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
              <div className="gen-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="gen-progress-label">{genProgress.current} / {genProgress.total} lessons</span>
          </div>
        )}

        {doneCount === total_sessions && !isGenerating && (
          <p className="gen-done-note">✓ All {total_sessions} lesson plans generated — click any session to read it</p>
        )}

        <button className="btn-secondary" onClick={onReset} style={{ marginLeft: 'auto' }}>
          Start over
        </button>
      </div>

      {error && (
        <div className="error-banner" role="alert" style={{ marginBottom: 16 }}>
          <strong>Couldn't generate lessons:</strong> {
            error.toLowerCase().includes('session not found')
              ? 'Your session expired (the server may have restarted). Please start over and re-upload your PDF.'
              : error
          }
          {error.toLowerCase().includes('session') && (
            <> &nbsp;<button className="btn-ghost" onClick={onReset} style={{ fontSize: 13 }}>Start over →</button></>
          )}
        </div>
      )}

      <div className="schedule-grid-wrap">
        <div
          className="schedule-grid"
          style={{ gridTemplateColumns: gridCols }}
          role="grid"
          aria-label="Curriculum schedule"
        >
          {/* Header row */}
          <div className="sg-corner" role="rowheader" />
          {dayNums.map(d => (
            <div key={d} className="sg-day-header" role="columnheader">{dayLabel(d)}</div>
          ))}

          {/* Week rows */}
          {Array.from({ length: total_weeks }, (_, wi) => {
            const weekNum = wi + 1
            const weekSlots = byWeek[weekNum] || {}
            return (
              <div key={weekNum} role="row" style={{ display: 'contents' }}>
                <div className="sg-week-label" role="rowheader">
                  Wk {weekNum}
                </div>
                {dayNums.map(d => {
                  const slot = weekSlots[d]
                  if (!slot) {
                    return (
                      <div key={d} className="sg-dash" role="gridcell" aria-label="No session">
                        <span className="sg-dash-inner" aria-hidden="true">—</span>
                      </div>
                    )
                  }
                  const lesson = lessons[slot.session_number]
                  const generating = isGenerating && genProgress?.current === slot.session_number
                  const chapterNames = slot.units.map(u => u.title).join(', ')
                  const truncated = chapterNames.length > 38 ? chapterNames.slice(0, 36) + '…' : chapterNames

                  return (
                    <div
                      key={d}
                      className={[
                        'sg-cell',
                        lesson && 'sg-cell--clickable',
                        generating && 'sg-cell--generating',
                      ].filter(Boolean).join(' ')}
                      role="gridcell"
                      tabIndex={lesson ? 0 : -1}
                      onClick={lesson ? () => onViewLesson(lesson) : undefined}
                      onKeyDown={lesson ? e => e.key === 'Enter' && onViewLesson(lesson) : undefined}
                      aria-label={`Session ${slot.session_number}: ${chapterNames}, pp. ${slot.start_page}–${slot.end_page}${lesson ? ' — lesson ready' : generating ? ' — generating' : ''}`}
                    >
                      <span className="sg-cell-session">S{slot.session_number}</span>
                      <span className="sg-cell-content">{truncated}</span>
                      <span className="sg-cell-pages">pp. {slot.start_page}–{slot.end_page}</span>
                      {lesson && (
                        <span className="sg-cell-status sg-status--ready" aria-hidden="true">Ready</span>
                      )}
                      {generating && !lesson && (
                        <span className="sg-cell-status sg-status--generating" aria-hidden="true">Writing…</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
