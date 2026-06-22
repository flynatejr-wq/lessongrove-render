import { useState } from 'react'
import { saveOutputToHistory } from '../history.js'

function CiteBadge({ pageRef }) {
  if (!pageRef) return null
  return <span className="source-cite">p. {pageRef}</span>
}

function ActionBar({ output, outputType, onBack, onSave, saved }) {
  const [exported, setExported] = useState(false)

  function handleExport() {
    const md = buildMarkdown(output, outputType)
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(output.title || 'output').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`
    a.click()
    URL.revokeObjectURL(url)
    setExported(true)
    setTimeout(() => setExported(false), 2000)
  }

  return (
    <div className="output-action-bar">
      <button
        className={`output-save-btn${saved ? ' output-save-btn--saved' : ''}`}
        onClick={onSave}
        disabled={saved}
      >
        {saved ? '✓ Saved to My Lessons' : 'Save'}
      </button>
      <button className="lesson-action-btn" onClick={handleExport}>
        {exported ? '✓ Exported' : '↓ Export .md'}
      </button>
      <button className="lesson-action-btn" onClick={() => window.print()}>
        🖨 Print
      </button>
      <button className="btn-ghost" onClick={onBack} style={{ fontSize: 13 }}>
        ← Back
      </button>
    </div>
  )
}

function buildMarkdown(output, outputType) {
  const lines = [`# ${output.title}`, `**Source:** ${output.source_ref}`, '']
  if (outputType === 'lecture_outline') {
    lines.push('## Overview', output.overview, '')
    for (const s of output.sections || []) {
      lines.push(`## ${s.heading}${s.duration_minutes ? ` *(${s.duration_minutes} min)*` : ''}`)
      for (const p of s.points || []) lines.push(`- ${p.text}${p.page_ref ? ` *(p. ${p.page_ref})*` : ''}`)
      lines.push('')
    }
  } else if (outputType === 'discussion_prompts') {
    lines.push('## Overview', output.overview, '')
    for (const [i, p] of (output.prompts || []).entries()) {
      lines.push(`## Discussion Question ${i + 1}`, p.prompt, '')
      if (p.follow_ups?.length) {
        lines.push('**Follow-ups:**')
        for (const f of p.follow_ups) lines.push(`- ${f}`)
        lines.push('')
      }
    }
  } else if (outputType === 'essay_prompt') {
    lines.push('## Essay Question', output.prompt, '', `**Word count:** ${output.word_count_guidance}`, '', '## Context', output.context, '', '## Rubric')
    for (const c of output.rubric || []) {
      lines.push(`### ${c.criterion} (${c.weight})`, `**Excellent:** ${c.excellent}`, `**Satisfactory:** ${c.satisfactory}`, `**Needs improvement:** ${c.needs_improvement}`, '')
    }
  } else if (outputType === 'question_bank') {
    for (const [i, q] of (output.questions || []).entries()) {
      lines.push(`## Question ${i + 1} [${q.type.replace('_', ' ')}]`, q.question)
      if (q.options?.length) for (const o of q.options) lines.push(o)
      lines.push(`**Answer:** ${q.answer}`, '')
    }
  }
  return lines.join('\n')
}

// ── Lecture Outline ───────────────────────────────────────────────────────────
function LectureOutlineBody({ output }) {
  return (
    <>
      {output.overview && (
        <section className="lesson-section">
          <h2 className="lesson-section-heading">Overview</h2>
          <p className="prof-overview">{output.overview}</p>
        </section>
      )}
      {(output.sections || []).map((s, i) => (
        <section key={i} className="lesson-section">
          <div className="lesson-section-hdr">
            <h2 className="lesson-section-heading">{s.heading}</h2>
            {s.duration_minutes && <span className="activity-duration">{s.duration_minutes} min</span>}
          </div>
          <ul className="prof-points">
            {(s.points || []).map((p, j) => (
              <li key={j} className="prof-point">
                <span>{p.text}</span>
                <CiteBadge pageRef={p.page_ref} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

// ── Discussion Prompts ────────────────────────────────────────────────────────
function DiscussionPromptsBody({ output }) {
  return (
    <>
      {output.overview && (
        <section className="lesson-section">
          <h2 className="lesson-section-heading">Overview</h2>
          <p className="prof-overview">{output.overview}</p>
        </section>
      )}
      <section className="lesson-section">
        <h2 className="lesson-section-heading">Discussion Questions</h2>
        <div className="prof-prompts">
          {(output.prompts || []).map((p, i) => (
            <div key={i} className="prof-prompt-card">
              <div className="prof-prompt-hdr">
                <span className="prof-prompt-num">{i + 1}</span>
                <p className="prof-prompt-text">{p.prompt}</p>
                <CiteBadge pageRef={p.page_ref} />
              </div>
              {p.follow_ups?.length > 0 && (
                <div className="prof-followups">
                  <p className="prof-followups-label">Follow-up questions</p>
                  <ul>
                    {p.follow_ups.map((f, j) => <li key={j}>{f}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

// ── Essay Prompt + Rubric ─────────────────────────────────────────────────────
function EssayPromptBody({ output }) {
  return (
    <>
      <section className="lesson-section">
        <h2 className="lesson-section-heading">Essay Question</h2>
        {output.context && <p className="prof-essay-context">{output.context}</p>}
        <p className="prof-essay-prompt">{output.prompt}</p>
        {output.word_count_guidance && (
          <p className="prof-word-count">Word count: {output.word_count_guidance}</p>
        )}
      </section>
      {output.rubric?.length > 0 && (
        <section className="lesson-section">
          <h2 className="lesson-section-heading">Grading Rubric</h2>
          <div className="prof-rubric">
            <div className="rubric-header">
              <span>Criterion</span>
              <span>Excellent</span>
              <span>Satisfactory</span>
              <span>Needs Improvement</span>
            </div>
            {output.rubric.map((c, i) => (
              <div key={i} className="rubric-row">
                <div className="rubric-criterion">
                  <strong>{c.criterion}</strong>
                  <span className="rubric-weight">{c.weight}</span>
                </div>
                <div className="rubric-cell">{c.excellent}</div>
                <div className="rubric-cell">{c.satisfactory}</div>
                <div className="rubric-cell rubric-cell--low">{c.needs_improvement}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

// ── Question Bank ─────────────────────────────────────────────────────────────
function QuestionBankBody({ output }) {
  const mc = (output.questions || []).filter(q => q.type === 'multiple_choice')
  const sa = (output.questions || []).filter(q => q.type === 'short_answer')
  const es = (output.questions || []).filter(q => q.type === 'essay')

  function QGroup({ questions, label, startIdx }) {
    if (!questions.length) return null
    return (
      <section className="lesson-section">
        <h2 className="lesson-section-heading">{label}</h2>
        <div className="qbank-list">
          {questions.map((q, i) => (
            <div key={i} className="qbank-item">
              <div className="qbank-question-row">
                <span className="qbank-num">{startIdx + i + 1}.</span>
                <p className="qbank-question">{q.question}</p>
                <CiteBadge pageRef={q.page_ref} />
              </div>
              {q.options?.length > 0 && (
                <ul className="qbank-options">
                  {q.options.map((o, j) => (
                    <li key={j} className={`qbank-option${o.startsWith(q.answer + '.') || o.startsWith(q.answer) ? ' qbank-option--correct' : ''}`}>
                      {o}
                    </li>
                  ))}
                </ul>
              )}
              <p className="qbank-answer"><strong>Answer:</strong> {q.answer}</p>
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <>
      <QGroup questions={mc} label="Multiple Choice" startIdx={0} />
      <QGroup questions={sa} label="Short Answer" startIdx={mc.length} />
      <QGroup questions={es} label="Essay Questions" startIdx={mc.length + sa.length} />
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
const TYPE_LABELS = {
  lecture_outline: 'Lecture Outline',
  discussion_prompts: 'Discussion Questions',
  essay_prompt: 'Essay Question & Rubric',
  question_bank: 'Question Bank',
}

export default function ProfessorOutputView({ output, outputType, onBack }) {
  const [saved, setSaved] = useState(false)

  function handleSave() {
    try {
      // Save as a synthetic lesson entry in history for My Lessons
      const entry = {
        ...output,
        _prof_output_type: outputType,
        generated_at: new Date().toISOString(),
      }
      const history = JSON.parse(localStorage.getItem('lessongrove_prof_outputs') || '[]')
      history.unshift(entry)
      if (history.length > 100) history.splice(100)
      localStorage.setItem('lessongrove_prof_outputs', JSON.stringify(history))
      setSaved(true)
    } catch {}
  }

  const typeLabel = TYPE_LABELS[outputType] || outputType

  return (
    <div className="lesson-view">
      <div className="lesson-layout">

        {/* Left rail */}
        <aside className="lesson-aside-left" aria-label="Output metadata">
          <span className="lesson-session-badge">{typeLabel}</span>
          <div className="lesson-meta-block">
            <p className="lesson-meta-label">Source</p>
            <p className="lesson-meta-value"><strong>{output.source_ref}</strong></p>
          </div>
          {output.scaffolding_level && (
            <div className="lesson-meta-block">
              <p className="lesson-meta-label">Support level</p>
              <p className="lesson-meta-value">{output.scaffolding_level}</p>
            </div>
          )}
          {output.standards_framework && (
            <div className="lesson-meta-block">
              <p className="lesson-meta-label">Standards</p>
              <p className="lesson-meta-value">{output.standards_framework}</p>
            </div>
          )}
        </aside>

        {/* Center */}
        <main className="lesson-content">
          <div className="prof-output-typetag">{typeLabel}</div>
          <h1 className="lesson-title">{output.title}</h1>
          <p className="lesson-page-range">{output.source_ref}</p>

          <div className="lesson-body">
            {outputType === 'lecture_outline' && <LectureOutlineBody output={output} />}
            {outputType === 'discussion_prompts' && <DiscussionPromptsBody output={output} />}
            {outputType === 'essay_prompt' && <EssayPromptBody output={output} />}
            {outputType === 'question_bank' && <QuestionBankBody output={output} />}
          </div>
        </main>

        {/* Right rail */}
        <aside className="lesson-aside-right" aria-label="Output actions">
          <button
            className={`lesson-action-btn lesson-action-btn--primary${saved ? ' lesson-action-btn--saved' : ''}`}
            onClick={handleSave}
            disabled={saved}
          >
            {saved ? '✓ Saved' : '💾 Save'}
          </button>
          <button className="lesson-action-btn" onClick={() => window.print()}>
            🖨 Print
          </button>
          <button className="lesson-action-btn" onClick={() => {
            const md = buildMarkdown(output, outputType)
            const blob = new Blob([md], { type: 'text/markdown' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = `${output.title.replace(/[^a-z0-9]/gi,'-').toLowerCase()}.md`; a.click()
            URL.revokeObjectURL(url)
          }}>↓ Export .md</button>
          <button className="lesson-action-btn" onClick={onBack} style={{ marginTop: 8 }}>← Back</button>
        </aside>

      </div>
    </div>
  )
}
