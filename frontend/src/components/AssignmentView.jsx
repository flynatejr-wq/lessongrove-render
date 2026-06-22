import { useState } from 'react'

const TYPE_LABELS = {
  worksheet: 'Worksheet',
  problem_set: 'Problem Set',
  discussion_prompt: 'Discussion Questions',
  project_brief: 'Project Brief',
}

const SCAFFOLD_LABELS = { light: 'Light support', standard: 'Standard', heavy: 'Heavy support' }

function ExportMarkdown({ assignment, showAnswers }) {
  function download() {
    const lines = [
      `# ${assignment.title}`,
      `**Type:** ${TYPE_LABELS[assignment.assignment_type] || assignment.assignment_type}`,
      `**Source:** ${assignment.source_ref}`,
      assignment.scaffolding_level ? `**Scaffolding:** ${SCAFFOLD_LABELS[assignment.scaffolding_level] || assignment.scaffolding_level}` : '',
      showAnswers ? '**Teacher copy — includes answer key**' : '',
      '',
      assignment.overview,
      '',
      '---',
      '',
      ...assignment.tasks.map(t =>
        `**${t.number}.** ${t.prompt}${t.page_ref ? `  *(p. ${t.page_ref})*` : ''}`
        + (showAnswers && t.answer ? `\n\n   _Answer:_ ${t.answer}` : '')
      ),
    ].filter(l => l !== '').join('\n')

    const blob = new Blob([lines], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${assignment.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <button className="lesson-action-btn" onClick={download}>
      <span aria-hidden="true">↓</span> Export .md
    </button>
  )
}

export default function AssignmentView({ assignment, onBack, isQuick = false }) {
  const [copied, setCopied] = useState(false)
  const [showAnswers, setShowAnswers] = useState(false)
  const [flagging, setFlagging] = useState(false)
  const [flagReason, setFlagReason] = useState('')
  const [flagSent, setFlagSent] = useState(false)

  const hasAnswers = assignment.tasks?.some(t => t.answer)

  function handleCopy() {
    const lines = [
      assignment.title, '',
      assignment.overview, '',
      '---', '',
      ...assignment.tasks.map(t => `${t.number}. ${t.prompt}${showAnswers && t.answer ? `\n   Answer: ${t.answer}` : ''}`),
    ].join('\n')
    navigator.clipboard?.writeText(lines).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  const typeLabel = TYPE_LABELS[assignment.assignment_type] || assignment.assignment_type

  return (
    <div className="lesson-view">
      <div className="lesson-layout">

        {/* Left rail */}
        <aside className="lesson-aside-left" aria-label="Assignment metadata">
          <span className="lesson-session-badge">{typeLabel}</span>

          <div className="lesson-meta-block">
            <p className="lesson-meta-label">Source</p>
            <p className="lesson-meta-value"><strong>{assignment.source_ref}</strong></p>
          </div>

          {assignment.source_sections?.length > 0 && (
            <div className="lesson-meta-block">
              <p className="lesson-meta-label">Sections covered</p>
              <ul className="lesson-source-list">
                {assignment.source_sections.map((s, i) => (
                  <li key={i} className="lesson-source-item">{s}</li>
                ))}
              </ul>
            </div>
          )}

          {assignment.scaffolding_level && (
            <div className="lesson-meta-block">
              <p className="lesson-meta-label">Support level</p>
              <p className="lesson-meta-value">{SCAFFOLD_LABELS[assignment.scaffolding_level] || assignment.scaffolding_level}</p>
            </div>
          )}

          <div className="lesson-meta-block">
            <p className="lesson-meta-label">Tasks</p>
            <p className="lesson-meta-value">{assignment.tasks.length}</p>
          </div>
        </aside>

        {/* Center content */}
        <main className="lesson-content">
          {/* Print-only worksheet header for student handouts */}
          <div className="worksheet-print-header print-only" aria-hidden="true">
            <span>Name: ______________________________</span>
            <span>Date: ____________</span>
            <span>Class: ____________</span>
          </div>

          <h1 className="lesson-title">{assignment.title}</h1>
          <p className="lesson-page-range">{typeLabel} · {assignment.source_ref}</p>

          <div className="lesson-body">
            {assignment.overview && (
              <section className="lesson-section">
                <h2 className="lesson-section-heading">Overview</h2>
                <p className="assignment-overview">{assignment.overview}</p>
              </section>
            )}

            <section className="lesson-section" aria-labelledby="tasks-heading">
              <h2 className="lesson-section-heading" id="tasks-heading">
                {typeLabel === 'Discussion Questions' ? 'Questions' :
                 typeLabel === 'Project Brief' ? 'Tasks & Milestones' : 'Tasks'}
              </h2>
              <ol className="assignment-task-list">
                {assignment.tasks.map(task => (
                  <li key={task.number} className="assignment-task-item">
                    <div className="assignment-task-prompt">{task.prompt}</div>
                    {task.page_ref && (
                      <span className="source-cite">p. {task.page_ref}</span>
                    )}
                    {showAnswers && task.answer && (
                      <div className="task-answer">
                        <span className="task-answer-label">Answer</span>
                        <span className="task-answer-text">{task.answer}</span>
                      </div>
                    )}
                    {!showAnswers && (
                      <div className="worksheet-answer-space print-only" aria-hidden="true" />
                    )}
                  </li>
                ))}
              </ol>
            </section>
          </div>

          {/* Flag UI */}
          {!isQuick && (
            <div className="flag-section">
              {flagSent ? (
                <p className="flag-sent">⚑ Flagged — thank you.</p>
              ) : flagging ? (
                <div className="flag-form">
                  <p className="flag-prompt">What doesn't match your source?</p>
                  <textarea
                    className="flag-textarea"
                    value={flagReason}
                    onChange={e => setFlagReason(e.target.value)}
                    placeholder="Describe the issue…"
                    rows={3}
                    aria-label="Describe the issue"
                  />
                  <div className="flag-actions">
                    <button className="btn-primary" style={{ fontSize: 13, padding: '6px 14px' }}
                      onClick={() => { setFlagSent(true); setFlagging(false) }}
                      disabled={!flagReason.trim()}>
                      Submit flag
                    </button>
                    <button className="btn-ghost" style={{ fontSize: 13 }}
                      onClick={() => setFlagging(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button className="flag-btn" onClick={() => setFlagging(true)}>
                  ⚑ This doesn't match my source
                </button>
              )}
            </div>
          )}
        </main>

        {/* Right rail — actions */}
        <aside className="lesson-aside-right" aria-label="Assignment actions">
          {hasAnswers && (
            <button
              className={`lesson-action-btn${showAnswers ? ' lesson-action-btn--keyon' : ''}`}
              onClick={() => setShowAnswers(s => !s)}
              aria-pressed={showAnswers}
            >
              <span aria-hidden="true">🔑</span> {showAnswers ? 'Hide answer key' : 'Show answer key'}
            </button>
          )}
          <button className="lesson-action-btn lesson-action-btn--primary" onClick={() => window.print()}>
            <span aria-hidden="true">🖨</span> Print {showAnswers ? '(teacher copy)' : ''}
          </button>
          <button className="lesson-action-btn" onClick={handleCopy}>
            <span aria-hidden="true">{copied ? '✓' : '📋'}</span> {copied ? 'Copied!' : 'Copy text'}
          </button>
          <ExportMarkdown assignment={assignment} showAnswers={showAnswers} />
          <button className="lesson-action-btn" onClick={onBack} style={{ marginTop: 8 }}>
            ← Back
          </button>
        </aside>

      </div>
    </div>
  )
}
