export default function LessonView({ lesson, onBack, isQuick = false }) {
  function handlePrint() { window.print() }

  function handleCopy() {
    const lines = [
      lesson.title,
      lesson.page_range,
      '',
      'LEARNING OBJECTIVES',
      ...lesson.learning_objectives.map((o, i) => `${i + 1}. ${o}`),
      '',
      'KEY CONCEPTS',
      ...lesson.key_concepts.map(kc => `${kc.term}: ${kc.definition}`),
      '',
      'CLASSROOM ACTIVITIES',
      ...lesson.activities.map(a => `• ${a.title}${a.duration_minutes ? ` (${a.duration_minutes} min)` : ''}\n  ${a.description}`),
      '',
      'ASSESSMENT QUESTIONS',
      ...lesson.assessment_questions.map((q, i) => `${i + 1}. [${q.type}] ${q.question}`),
      lesson.homework ? `\nHOMEWORK\n${lesson.homework}` : '',
    ].filter(l => l !== '').join('\n')
    navigator.clipboard?.writeText(lines).catch(() => {})
  }

  const sessionLabel = isQuick
    ? 'Quick Lesson'
    : `Session ${lesson.session_number} · Week ${lesson.week_number}, Day ${lesson.day_number}`

  return (
    <div className="lesson-view">
      <div className="lesson-layout">

        {/* ── Left rail — metadata + source traceability ── */}
        <aside className="lesson-aside-left" aria-label="Lesson metadata">
          <span className="lesson-session-badge">{sessionLabel}</span>

          <div className="lesson-meta-block">
            <p className="lesson-meta-label">Source pages</p>
            <p className="lesson-meta-value">
              <strong>{lesson.page_range}</strong>
            </p>
          </div>

          {lesson.source_sections?.length > 0 && (
            <div className="lesson-meta-block">
              <p className="lesson-meta-label">Sections covered</p>
              <ul className="lesson-source-list" aria-label="Sections">
                {lesson.source_sections.map((s, i) => (
                  <li key={i} className="lesson-source-item">{s}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        {/* ── Center — lesson content ── */}
        <main className="lesson-content">
          <h1 className="lesson-title">{lesson.title}</h1>
          <p className="lesson-page-range">{lesson.page_range}</p>

          <div className="lesson-body">
            {lesson.learning_objectives?.length > 0 && (
              <section className="lesson-section" aria-labelledby="obj-heading">
                <h2 className="lesson-section-heading" id="obj-heading">Learning objectives</h2>
                <ul className="lesson-objectives">
                  {lesson.learning_objectives.map((obj, i) => <li key={i}>{obj}</li>)}
                </ul>
              </section>
            )}

            {lesson.key_concepts?.length > 0 && (
              <section className="lesson-section" aria-labelledby="kc-heading">
                <h2 className="lesson-section-heading" id="kc-heading">Key concepts</h2>
                <dl className="concept-list">
                  {lesson.key_concepts.map((kc, i) => (
                    <div key={i} className="concept-row">
                      <dt className="concept-term">{kc.term}</dt>
                      <dd className="concept-def">{kc.definition}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {lesson.activities?.length > 0 && (
              <section className="lesson-section" aria-labelledby="act-heading">
                <h2 className="lesson-section-heading" id="act-heading">Classroom activities</h2>
                <div className="activity-list">
                  {lesson.activities.map((act, i) => (
                    <div key={i} className="activity-card">
                      <div className="activity-card-header">
                        <span className="activity-title">{act.title}</span>
                        {act.duration_minutes && (
                          <span className="activity-duration">{act.duration_minutes} min</span>
                        )}
                      </div>
                      <p className="activity-desc">{act.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {lesson.assessment_questions?.length > 0 && (
              <section className="lesson-section" aria-labelledby="aq-heading">
                <h2 className="lesson-section-heading" id="aq-heading">Assessment questions</h2>
                <ol className="question-list">
                  {lesson.assessment_questions.map((q, i) => (
                    <li key={i} className="question-item">
                      <span className="question-text">{q.question}</span>
                      <span className={`question-type question-type--${q.type}`}>
                        {q.type.replace('_', ' ')}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {lesson.homework && (
              <section className="lesson-section" aria-labelledby="hw-heading">
                <h2 className="lesson-section-heading" id="hw-heading">Homework</h2>
                <p className="lesson-homework">{lesson.homework}</p>
              </section>
            )}
          </div>
        </main>

        {/* ── Right rail — actions ── */}
        <aside className="lesson-aside-right" aria-label="Lesson actions">
          <button className="lesson-action-btn lesson-action-btn--primary" onClick={handlePrint}>
            <span aria-hidden="true">🖨</span> Print
          </button>
          <button className="lesson-action-btn" onClick={handleCopy}>
            <span aria-hidden="true">📋</span> Copy text
          </button>
          <button className="lesson-action-btn" onClick={onBack} style={{ marginTop: 8 }}>
            ← Back
          </button>
        </aside>

      </div>
    </div>
  )
}
