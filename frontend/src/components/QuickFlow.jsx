import { useState } from 'react'
import SourcePicker from './SourcePicker.jsx'
import StructureView from './StructureView.jsx'
import LessonView from './LessonView.jsx'
import AssignmentView from './AssignmentView.jsx'
import ProfessorOutputView from './ProfessorOutputView.jsx'
import GeneratingLoader from './GeneratingLoader.jsx'
import { quickLesson } from '../api.js'
import { saveTermToHistory } from '../history.js'

const ASSIGNMENT_TYPES = [
  { id: 'worksheet',         label: 'Worksheet',          desc: 'Structured questions guiding students through the content' },
  { id: 'problem_set',       label: 'Problem set',        desc: 'Practice problems requiring application of concepts' },
  { id: 'discussion_prompt', label: 'Discussion prompts', desc: 'Open-ended prompts for class or small-group discussion' },
  { id: 'project_brief',     label: 'Project brief',      desc: 'Multi-step challenge with a real deliverable' },
]

const K12_OUTPUT_TYPES = [
  { id: 'lesson',      label: 'Lesson Plan',  desc: 'Objectives, activities, assessment, and homework' },
  { id: 'assignment',  label: 'Assignment',   desc: 'Student-facing worksheet, problem set, or project' },
]

const PROF_OUTPUT_TYPES = [
  { id: 'lesson',             label: 'Lesson Plan',         desc: 'Objectives, activities, assessment, and homework' },
  { id: 'lecture_outline',    label: 'Lecture Outline',     desc: 'Structured outline with talking points for your lecture' },
  { id: 'discussion_prompts', label: 'Discussion Prompts',  desc: 'Seminar-style questions grounded in your source material' },
  { id: 'essay_prompt',       label: 'Essay Prompt + Rubric', desc: 'Essay question tied to source material with a grading rubric' },
  { id: 'question_bank',      label: 'Question Bank',       desc: 'MC, short answer, and essay questions with answer keys' },
  { id: 'assignment',         label: 'Assignment',          desc: 'Student-facing worksheet, problem set, or project' },
]

const PROFESSOR_OUTPUT_TYPES = new Set(['lecture_outline', 'discussion_prompts', 'essay_prompt', 'question_bank'])

function loadProfile() {
  try { return JSON.parse(localStorage.getItem('lessongrove_profile')) } catch { return null }
}

export default function QuickFlow({ onBack, defaultScaffolding = 'standard' }) {
  const profile = loadProfile()
  const isProfessor = profile?.userType === 'professor'
  const OUTPUT_TYPES = isProfessor ? PROF_OUTPUT_TYPES : K12_OUTPUT_TYPES

  const [step, setStep]   = useState('source')
  const [sourceData, setSourceData]     = useState(null)
  const [selectedChapterIdx, setSelectedChapterIdx] = useState(null)
  const [startPage, setStartPage] = useState('')
  const [endPage, setEndPage]     = useState('')

  const [outputType, setOutputType]         = useState('lesson')
  const [assignmentType, setAssignmentType] = useState('worksheet')
  const [scaffolding, setScaffolding]       = useState(defaultScaffolding)

  const [result, setResult] = useState(null)
  const [resultKind, setResultKind] = useState(null)   // 'lesson' | 'assignment'
  const [error, setError]   = useState(null)

  const isPdf = sourceData?.sourceType === 'pdf'

  function handleIngested(payload) {
    setSourceData(payload)
    setStep('configure')
    setError(null)
  }

  function handleChapterSelect(idx, chapter) {
    setSelectedChapterIdx(idx)
    setStartPage(String(chapter.start_page))
    setEndPage(String(chapter.end_page ?? chapter.start_page))
  }

  function clearChapterSelection() {
    setSelectedChapterIdx(null)
    setStartPage('')
    setEndPage('')
  }

  async function handleGenerate() {
    setError(null)
    const data = sourceData.data
    let start = null
    let end   = null

    if (isPdf) {
      start = parseInt(startPage, 10)
      end   = parseInt(endPage, 10)
      const total = data.total_pages
      if (!start || !end || start < 1 || end > total || start > end) {
        setError(`Enter a valid page range between 1 and ${total}.`)
        return
      }
    }

    setStep('generating')
    try {
      const title = isPdf && selectedChapterIdx !== null
        ? data.structure?.chapters?.[selectedChapterIdx]?.title
        : data.filename || 'Quick lesson'

      const res = await quickLesson(
        data.session_id,
        start, end,
        title,
        scaffolding,
        null,
        outputType,
        assignmentType,
      )
      setResult(res)
      setResultKind(outputType)
      setStep('result')
      // Save to history so it appears in My Lessons
      saveTermToHistory({
        id: data.session_id,
        filename: title,
        savedAt: new Date().toISOString(),
        weeks: 1,
        sessionsPerWeek: 1,
        scaffolding,
        schedule: { total_sessions: 1, total_weeks: 1, sessions_per_week: 1, sessions: [] },
        lessons: { 1: { ...res, session_number: 1, generated_at: new Date().toISOString() } },
      })
    } catch (err) {
      setError(err.message)
      setStep('configure')
    }
  }

  function resetSource() {
    setSourceData(null); setStep('source')
    setSelectedChapterIdx(null); setStartPage(''); setEndPage('')
    setResult(null); setError(null)
  }

  // ── Result screens ────────────────────────────────────────────────────────
  if (step === 'result' && result) {
    if (PROFESSOR_OUTPUT_TYPES.has(resultKind)) {
      return <ProfessorOutputView output={result} outputType={resultKind} onBack={() => setStep('configure')} />
    }
    if (resultKind === 'assignment') {
      return <AssignmentView assignment={result} isQuick onBack={() => setStep('configure')} />
    }
    return <LessonView lesson={result} isQuick onBack={() => setStep('configure')} />
  }

  // ── Source picker ─────────────────────────────────────────────────────────
  if (step === 'source') {
    return (
      <div className="quick-step">
        <div className="step-header">
          <p className="step-kicker">Quick lesson · Step 1 of 2</p>
          <h1 className="step-title">Choose your source</h1>
          <p className="step-sub">Upload a file, paste text, or drop a link — LessonGrove grounds every lesson in your real content.</p>
        </div>
        <SourcePicker onIngested={handleIngested} onBack={onBack} />
      </div>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (step === 'generating') {
    return (
      <GeneratingLoader
        outputType={outputType === 'assignment' ? assignmentType : outputType}
        title={`Writing your ${OUTPUT_TYPES.find(t => t.id === outputType)?.label.toLowerCase() || 'content'}…`}
      />
    )
  }

  // ── Configure ─────────────────────────────────────────────────────────────
  const data = sourceData?.data
  return (
    <div className="quick-step">
      <div className="step-header">
        <p className="step-kicker">Quick lesson · Step 2 of 2</p>
        <h1 className="step-title">Set your options</h1>
        {isPdf && <p className="step-sub">Select a chapter below, or enter a custom page range.</p>}
      </div>

      <div className="quick-configure">

        {/* PDF: chapter/page picker */}
        {isPdf && data?.structure && (
          <>
            <StructureView
              data={data}
              selectable
              onSelect={handleChapterSelect}
              selectedIdx={selectedChapterIdx}
            />
            <div className="quick-or">— or enter a custom page range —</div>
            <div className="quick-range">
              <span className="quick-range-label">Pages</span>
              <input type="number" className="quick-range-input"
                min={1} max={data.total_pages} value={startPage}
                onChange={e => { setStartPage(e.target.value); clearChapterSelection() }}
                placeholder="1" aria-label="Start page" />
              <span className="quick-range-sep" aria-hidden="true">to</span>
              <input type="number" className="quick-range-input"
                min={1} max={data.total_pages} value={endPage}
                onChange={e => { setEndPage(e.target.value); clearChapterSelection() }}
                placeholder={String(data.total_pages)} aria-label="End page" />
              <span className="quick-range-label" style={{ marginLeft: 4 }}>of {data.total_pages}</span>
            </div>
          </>
        )}

        {/* Non-PDF: show source summary */}
        {!isPdf && data && (
          <div className="source-summary-card">
            <span className="source-summary-icon" aria-hidden="true">
              {sourceData.sourceType === 'youtube' ? '▶' :
               sourceData.sourceType === 'url'     ? '🔗' :
               sourceData.sourceType === 'text'    ? '✏️' :
               sourceData.sourceType === 'docx'    ? '📝' :
               sourceData.sourceType === 'image'   ? '🖼' : '📄'}
            </span>
            <div className="source-summary-info">
              <strong className="source-summary-name">{data.filename}</strong>
              <span className="source-summary-meta">{data.total_pages} chunk{data.total_pages !== 1 ? 's' : ''} extracted · {data.content_type}</span>
            </div>
            <button className="btn-ghost source-summary-change" onClick={resetSource} style={{ fontSize: 12 }}>
              Change source
            </button>
          </div>
        )}

        {/* Output type: profile-aware */}
        <div className="quick-options">
          <div className="quick-option-group">
            <span className="section-label">What do you need?</span>
            <div className="output-type-grid" role="group" aria-label="Output type">
              {OUTPUT_TYPES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={`output-type-card${outputType === t.id ? ' output-type-card--active' : ''}`}
                  onClick={() => setOutputType(t.id)}
                  aria-pressed={outputType === t.id}
                >
                  <span className="output-type-card-label">{t.label}</span>
                  <span className="output-type-card-desc">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Assignment type (only when assignment selected) */}
          {outputType === 'assignment' && (
            <div className="quick-option-group">
              <span className="section-label">Assignment type</span>
              <div className="assignment-type-grid">
                {ASSIGNMENT_TYPES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    className={`assignment-type-card${assignmentType === t.id ? ' assignment-type-card--active' : ''}`}
                    onClick={() => setAssignmentType(t.id)}
                    aria-pressed={assignmentType === t.id}
                  >
                    <span className="assignment-type-label">{t.label}</span>
                    <span className="assignment-type-desc">{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Scaffolding */}
          <div className="quick-option-group">
            <span className="section-label">Support level</span>
            <div className="scaffold-dial" role="group" aria-label="Scaffolding level">
              {['light', 'standard', 'heavy'].map(opt => (
                <button
                  key={opt}
                  type="button"
                  className={`scaffold-btn${scaffolding === opt ? ' scaffold-btn--active' : ''}`}
                  onClick={() => setScaffolding(opt)}
                  aria-pressed={scaffolding === opt}
                >
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="error-banner" role="alert" style={{ marginTop: 12 }}>{error}</p>}

        <div className="quick-actions">
          <button
            className="btn-primary"
            onClick={handleGenerate}
            disabled={isPdf && !startPage && selectedChapterIdx === null}
          >
            Generate {OUTPUT_TYPES.find(t => t.id === outputType)?.label.toLowerCase() || outputType.replace('_', ' ')} →
          </button>
          <button className="btn-ghost" onClick={resetSource}>
            ← Change source
          </button>
        </div>
      </div>
    </div>
  )
}
