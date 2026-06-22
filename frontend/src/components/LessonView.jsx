import { useState } from 'react'
import { flagLesson, regenerateSection } from '../api.js'

const SCAFFOLD_LABELS = { light: 'Light support', standard: 'Standard', heavy: 'Heavy support' }

function ExportMarkdown({ lesson }) {
  function download() {
    const lines = [
      `# ${lesson.title}`,
      `**Source:** ${lesson.page_range}`,
      lesson.standards_framework ? `**Standards:** ${lesson.standards_framework}` : '',
      lesson.scaffolding_level ? `**Scaffolding:** ${SCAFFOLD_LABELS[lesson.scaffolding_level] || lesson.scaffolding_level}` : '',
      '',
      '## Learning Objectives',
      ...lesson.learning_objectives.map((o, i) => `${i + 1}. ${o}`),
      '',
      '## Key Concepts',
      ...lesson.key_concepts.map(kc => `**${kc.term}:** ${kc.definition}`),
      '',
      '## Classroom Activities',
      ...lesson.activities.map(a => [
        `### ${a.title}${a.duration_minutes ? ` *(${a.duration_minutes} min)*` : ''}`,
        a.description,
      ].join('\n')),
      '',
      '## Assessment Questions',
      ...lesson.assessment_questions.map((q, i) => `${i + 1}. *[${q.type.replace('_', ' ')}]* ${q.question}`),
      lesson.homework ? `\n## Homework\n${lesson.homework}` : '',
    ].filter(l => l !== '').join('\n')

    const blob = new Blob([lines], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${lesson.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button className="lesson-action-btn" onClick={download}>
      <span aria-hidden="true">↓</span> Export .md
    </button>
  )
}

function RegenerateBtn({ label, section, sessionId, sessionNumber, scaffolding, standards, onDone, onRegenStart, onRegenEnd, isQuick }) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  if (isQuick) return null  // no session in storage for quick lessons

  async function handle() {
    setLoading(true); setErr(null)
    if (onRegenStart) onRegenStart(section)
    try {
      const result = await regenerateSection(sessionId, sessionNumber, section, scaffolding, standards)
      onDone(section, result.data)
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
      if (onRegenEnd) onRegenEnd(section)
    }
  }

  return (
    <span className="regen-wrap">
      <button className="regen-btn" onClick={handle} disabled={loading} aria-label={`Regenerate ${label}`}>
        {loading ? '…' : '↻'}
      </button>
      {err && <span className="regen-err" role="alert">{err}</span>}
    </span>
  )
}

export default function LessonView({ lesson: initialLesson, onBack, isQuick = false, sessionId = null, readOnly = false }) {
  const [lesson, setLesson] = useState(initialLesson)
  const [flagging, setFlagging] = useState(false)
  const [flagShook, setFlagShook] = useState(false)
  const [flagReason, setFlagReason] = useState('')
  const [flagSent, setFlagSent] = useState(false)
  const [flagErr, setFlagErr] = useState(null)
  const [copied, setCopied] = useState(false)
  const [regenSection, setRegenSection] = useState(null)

  function handleFlagClick() {
    setFlagging(true)
    setFlagShook(true)
    setTimeout(() => setFlagShook(false), 300)
  }

  function patchLesson(section, data) {
    setLesson(prev => {
      if (section === 'learning_objectives') return { ...prev, learning_objectives: data }
      if (section === 'key_concepts') return { ...prev, key_concepts: data }
      if (section === 'activities') return { ...prev, activities: data }
      if (section === 'assessment_questions') return { ...prev, assessment_questions: data }
      if (section === 'homework') return { ...prev, homework: data }
      return prev
    })
  }

  async function submitFlag() {
    if (!flagReason.trim() || !sessionId) return
    try {
      await flagLesson(sessionId, lesson.session_number, flagReason.trim())
      setFlagSent(true); setFlagging(false); setFlagErr(null)
    } catch (e) {
      setFlagErr(e.message)
    }
  }

  function handleCopy() {
    const lines = [
      lesson.title, lesson.page_range, '',
      'LEARNING OBJECTIVES',
      ...lesson.learning_objectives.map((o, i) => `${i + 1}. ${o}`), '',
      'KEY CONCEPTS',
      ...lesson.key_concepts.map(kc => `${kc.term}: ${kc.definition}`), '',
      'CLASSROOM ACTIVITIES',
      ...lesson.activities.map(a => `• ${a.title}${a.duration_minutes ? ` (${a.duration_minutes} min)` : ''}\n  ${a.description}`), '',
      'ASSESSMENT QUESTIONS',
      ...lesson.assessment_questions.map((q, i) => `${i + 1}. [${q.type}] ${q.question}`),
      lesson.homework ? `\nHOMEWORK\n${lesson.homework}` : '',
    ].filter(l => l !== '').join('\n')
    navigator.clipboard?.writeText(lines).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {})
  }

  const sessionLabel = isQuick
    ? 'Quick Lesson'
    : `Session ${lesson.session_number} · Week ${lesson.week_number}, Day ${lesson.day_number}`

  const regenProps = {
    sessionId, sessionNumber: lesson.session_number,
    scaffolding: lesson.scaffolding_level, standards: lesson.standards_framework,
    isQuick, onDone: patchLesson,
    onRegenStart: s => setRegenSection(s),
    onRegenEnd: () => setRegenSection(null),
  }

  return (
    <div className="lesson-view">
      <div className="lesson-layout">

        {/* ── Left rail — metadata + source traceability ── */}
        <aside className="lesson-aside-left" aria-label="Lesson metadata">
          <span className="lesson-session-badge">{sessionLabel}</span>

          <div className="lesson-meta-block">
            <p className="lesson-meta-label">Source pages</p>
            <p className="lesson-meta-value"><strong>{lesson.page_range}</strong></p>
          </div>

          {lesson.source_sections?.length > 0 && (
            <div className="lesson-meta-block">
              <p className="lesson-meta-label">Sections covered</p>
              <ul className="lesson-source-list">
                {lesson.source_sections.map((s, i) => <li key={i} className="lesson-source-item">{s}</li>)}
              </ul>
            </div>
          )}

          {lesson.scaffolding_level && (
            <div className="lesson-meta-block">
              <p className="lesson-meta-label">Support level</p>
              <p className="lesson-meta-value">{SCAFFOLD_LABELS[lesson.scaffolding_level] || lesson.scaffolding_level}</p>
            </div>
          )}

          {lesson.standards_framework && (
            <div className="lesson-meta-block">
              <p className="lesson-meta-label">Standards</p>
              <p className="lesson-meta-value">{lesson.standards_framework}</p>
            </div>
          )}

          {lesson.flags?.length > 0 && (
            <div className="lesson-meta-block">
              <p className="lesson-meta-label" style={{ color: 'var(--terra)' }}>⚑ Flagged ({lesson.flags.length})</p>
            </div>
          )}
        </aside>

        {/* ── Center — lesson content ── */}
        <main className="lesson-content">
          <h1 className="lesson-title">{lesson.title}</h1>
          <p className="lesson-page-range">{lesson.page_range}</p>

          <div className="lesson-body">
            {lesson.learning_objectives?.length > 0 && (
              <section className={`lesson-section${regenSection === 'learning_objectives' ? ' lesson-section--regenerating' : ''}`} aria-labelledby="obj-heading">
                <div className="lesson-section-hdr">
                  <h2 className="lesson-section-heading" id="obj-heading">Learning objectives</h2>
                  <RegenerateBtn label="learning objectives" section="learning_objectives" {...regenProps} />
                </div>
                <ul className="lesson-objectives">
                  {lesson.learning_objectives.map((obj, i) => {
                    const text = typeof obj === 'string' ? obj : obj.text
                    const ref = typeof obj === 'string' ? null : obj.page_ref
                    return (
                      <li key={i}>
                        {text}
                        {ref && <span className="source-cite">p. {ref}</span>}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            {lesson.key_concepts?.length > 0 && (
              <section className={`lesson-section${regenSection === 'key_concepts' ? ' lesson-section--regenerating' : ''}`} aria-labelledby="kc-heading">
                <div className="lesson-section-hdr">
                  <h2 className="lesson-section-heading" id="kc-heading">Key concepts</h2>
                  <RegenerateBtn label="key concepts" section="key_concepts" {...regenProps} />
                </div>
                <dl className="concept-list">
                  {lesson.key_concepts.map((kc, i) => (
                    <div key={i} className="concept-row">
                      <dt className="concept-term">
                        {kc.term}
                        {kc.page_ref && <span className="source-cite">p. {kc.page_ref}</span>}
                      </dt>
                      <dd className="concept-def">{kc.definition}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {lesson.activities?.length > 0 && (
              <section className={`lesson-section${regenSection === 'activities' ? ' lesson-section--regenerating' : ''}`} aria-labelledby="act-heading">
                <div className="lesson-section-hdr">
                  <h2 className="lesson-section-heading" id="act-heading">Classroom activities</h2>
                  <RegenerateBtn label="activities" section="activities" {...regenProps} />
                </div>
                <div className="activity-list">
                  {lesson.activities.map((act, i) => (
                    <div key={i} className="activity-card">
                      <div className="activity-card-header">
                        <span className="activity-title">{act.title}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {act.duration_minutes && <span className="activity-duration">{act.duration_minutes} min</span>}
                          {act.page_ref && <span className="source-cite">p. {act.page_ref}</span>}
                        </div>
                      </div>
                      <p className="activity-desc">{act.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {lesson.assessment_questions?.length > 0 && (
              <section className={`lesson-section${regenSection === 'assessment_questions' ? ' lesson-section--regenerating' : ''}`} aria-labelledby="aq-heading">
                <div className="lesson-section-hdr">
                  <h2 className="lesson-section-heading" id="aq-heading">Assessment questions</h2>
                  <RegenerateBtn label="assessment questions" section="assessment_questions" {...regenProps} />
                </div>
                <ol className="question-list">
                  {lesson.assessment_questions.map((q, i) => (
                    <li key={i} className="question-item">
                      <span className="question-text">{q.question}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span className={`question-type question-type--${q.type}`}>{q.type.replace('_', ' ')}</span>
                        {q.page_ref && <span className="source-cite">p. {q.page_ref}</span>}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {(lesson.homework !== null && lesson.homework !== undefined) && (
              <section className={`lesson-section${regenSection === 'homework' ? ' lesson-section--regenerating' : ''}`} aria-labelledby="hw-heading">
                <div className="lesson-section-hdr">
                  <h2 className="lesson-section-heading" id="hw-heading">Homework</h2>
                  <RegenerateBtn label="homework" section="homework" {...regenProps} />
                </div>
                {lesson.homework
                  ? <p className="lesson-homework">{lesson.homework}</p>
                  : <p className="lesson-homework" style={{ color: 'var(--bark)', fontStyle: 'italic' }}>No homework assigned.</p>
                }
              </section>
            )}
          </div>

          {/* Flag UI */}
          {!isQuick && (
            <div className="flag-section">
              {flagSent ? (
                <p className="flag-sent">⚑ Flagged — thank you. This will be noted alongside the lesson.</p>
              ) : flagging ? (
                <div className="flag-form">
                  <p className="flag-prompt">What doesn't match your textbook?</p>
                  <textarea
                    className="flag-textarea"
                    value={flagReason}
                    onChange={e => setFlagReason(e.target.value)}
                    placeholder="e.g. The key concepts listed don't appear in my edition of this chapter."
                    rows={3}
                    aria-label="Describe the issue"
                  />
                  {flagErr && <p className="flag-err">{flagErr}</p>}
                  <div className="flag-actions">
                    <button className="btn-primary" style={{ fontSize: 13, padding: '6px 14px' }} onClick={submitFlag} disabled={!flagReason.trim()}>
                      Submit flag
                    </button>
                    <button className="btn-ghost" style={{ fontSize: 13 }} onClick={() => { setFlagging(false); setFlagErr(null) }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className={`flag-btn${flagShook ? ' flag-btn--shake' : ''}`}
                  onClick={handleFlagClick}
                >
                  ⚑ This doesn't match my textbook
                </button>
              )}
            </div>
          )}
        </main>

        {/* ── Right rail — actions ── */}
        <aside className="lesson-aside-right" aria-label="Lesson actions">
          {!readOnly && (
            <div className="lesson-action-btn lesson-action-btn--saved" aria-label="Saved to My Lessons">
              <span aria-hidden="true">✓</span> Saved to My Lessons
            </div>
          )}
          <button className="lesson-action-btn" onClick={() => window.print()}>
            <span aria-hidden="true">🖨</span> Print
          </button>
          <button className="lesson-action-btn" onClick={handleCopy}>
            <span aria-hidden="true">{copied ? '✓' : '📋'}</span> {copied ? 'Copied!' : 'Copy text'}
          </button>
          <ExportMarkdown lesson={lesson} />
          <button className="lesson-action-btn" onClick={onBack} style={{ marginTop: 8 }}>
            ← Back
          </button>
        </aside>

      </div>
    </div>
  )
}
