import { useState, useEffect } from 'react'
import Home from './components/Home.jsx'
import QuickFlow from './components/QuickFlow.jsx'
import UploadForm from './components/UploadForm.jsx'
import StructureView from './components/StructureView.jsx'
import CourseForm from './components/CourseForm.jsx'
import ScheduleGrid from './components/ScheduleGrid.jsx'
import LessonView from './components/LessonView.jsx'
import History from './components/History.jsx'
import { paceCurriculum, generateLessons, updateStructure, getCostEstimate } from './api.js'
import { saveTermToHistory } from './history.js'

const SETTINGS_KEY = 'lessongrove_settings'
const THEME_KEY = 'lessongrove_theme'

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {} }
  catch { return {} }
}

function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch {}
}

function getInitialTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch {}
  return 'dark'
}

function LogoMark() {
  return (
    <svg className="logo-mark" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="32" height="32" rx="6" fill="#b5562f"/>
      <rect x="4"    y="20" width="7" height="8"  fill="white"/>
      <rect x="12.5" y="12" width="7" height="16" fill="white"/>
      <rect x="21"   y="4"  width="7" height="24" fill="white"/>
    </svg>
  )
}

function ThemeToggle({ theme, onToggle }) {
  return (
    <button
      className="theme-toggle"
      onClick={onToggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
    >
      {theme === 'dark' ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M11.89 4.11l1.06-1.06M3.05 12.95l1.06-1.06" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M13.5 9.5A5.5 5.5 0 016.5 2.5a5.5 5.5 0 107 7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  )
}

export default function App() {
  const [theme, setTheme] = useState(getInitialTheme)
  const [mode, setMode] = useState(null)
  const [fullStep, setFullStep] = useState('upload')
  const [uploadData, setUploadData] = useState(null)
  const [scheduleData, setScheduleData] = useState(null)
  const [lessons, setLessons] = useState({})
  const [isGenerating, setIsGenerating] = useState(false)
  const [genProgress, setGenProgress] = useState(null)
  const [activeLesson, setActiveLesson] = useState(null)
  const [error, setError] = useState(null)
  const [costEstimate, setCostEstimate] = useState(null)
  const [structureSaving, setStructureSaving] = useState(false)

  const saved = loadSettings()
  const [scaffolding, setScaffolding] = useState(saved.scaffolding || 'standard')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem(THEME_KEY, theme) } catch {}
  }, [theme])

  useEffect(() => {
    saveSettings({ scaffolding })
  }, [scaffolding])

  function toggleTheme() {
    setTheme(t => t === 'dark' ? 'light' : 'dark')
  }

  function reset() {
    setMode(null); setFullStep('upload')
    setUploadData(null); setScheduleData(null)
    setLessons({}); setIsGenerating(false)
    setGenProgress(null); setActiveLesson(null)
    setError(null); setCostEstimate(null)
  }

  function handleUploadResult(result) {
    if (result.status === 'uploading') { setFullStep('uploading'); setError(null) }
    else if (result.status === 'done') { setUploadData(result.data); setFullStep('structure') }
    else { setError(result.message); setFullStep('upload') }
  }

  async function handleStructureChange(chapters) {
    setStructureSaving(true); setError(null)
    try {
      await updateStructure(uploadData.session_id, chapters)
      setUploadData(prev => ({ ...prev, structure: { ...prev.structure, chapters } }))
    } catch (err) {
      setError(`Couldn't save structure: ${err.message}`)
    } finally {
      setStructureSaving(false)
    }
  }

  async function handlePace(weeks, sessionsPerWeek, newScaffolding, _standards, termStart, holidays) {
    setScaffolding(newScaffolding)
    setFullStep('pacing'); setError(null); setCostEstimate(null)
    try {
      const data = await paceCurriculum(uploadData.session_id, weeks, sessionsPerWeek, termStart, holidays)
      setScheduleData(data); setLessons({}); setGenProgress(null)
      try {
        const est = await getCostEstimate(uploadData.session_id, data.schedule.total_sessions)
        setCostEstimate(est)
      } catch {}
      setFullStep('schedule')
    } catch (err) {
      setError(err.message); setFullStep('structure')
    }
  }

  async function handleGenerateLessons() {
    if (!scheduleData || isGenerating) return
    const hasExisting = Object.keys(lessons).length > 0
    setIsGenerating(true); setError(null)
    const total = scheduleData.schedule.total_sessions
    setGenProgress({ current: 0, total })
    const sseErrors = []
    const newLessons = { ...lessons }
    try {
      await generateLessons(
        uploadData.session_id,
        event => {
          if (event.status === 'generating') {
            setGenProgress({ current: event.session_number, total: event.total_sessions })
          } else if (event.status === 'done' && event.lesson) {
            newLessons[event.lesson.session_number] = event.lesson
            setLessons(prev => ({ ...prev, [event.lesson.session_number]: event.lesson }))
            setGenProgress({ current: event.session_number, total: event.total_sessions })
          } else if (event.status === 'skipped' && event.lesson) {
            newLessons[event.lesson.session_number] = event.lesson
            setLessons(prev => ({ ...prev, [event.lesson.session_number]: event.lesson }))
          } else if (event.status === 'error') {
            sseErrors.push(event.error)
          }
        },
        scaffolding,
        null,
        hasExisting,
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setIsGenerating(false); setGenProgress(null)
      if (sseErrors.length > 0) {
        const msg = sseErrors.length === 1
          ? `Lesson generation failed: ${sseErrors[0]}`
          : `${sseErrors.length} lessons failed. First error: ${sseErrors[0]}`
        setError(msg)
      }
      // Auto-save to history when at least one lesson was generated
      const allLessons = { ...lessons, ...newLessons }
      if (Object.keys(allLessons).length > 0 && scheduleData) {
        saveTermToHistory({
          id: uploadData.session_id,
          filename: uploadData.filename,
          savedAt: new Date().toISOString(),
          weeks: scheduleData.schedule.total_weeks,
          sessionsPerWeek: scheduleData.schedule.sessions_per_week,
          scaffolding,
          schedule: scheduleData.schedule,
          lessons: allLessons,
        })
      }
    }
  }

  function handleViewLesson(lesson) {
    setActiveLesson(lesson); setFullStep('lesson')
  }

  function handleBackToSchedule() {
    setActiveLesson(null); setFullStep('schedule')
  }

  function handleLessonUpdate(updatedLesson) {
    setLessons(prev => ({ ...prev, [updatedLesson.session_number]: updatedLesson }))
    setActiveLesson(updatedLesson)
  }

  function handleRestoreTerm(term) {
    // Restore a term from history into the schedule view
    setUploadData({ session_id: term.id, filename: term.filename, structure: term.schedule })
    setScheduleData({ filename: term.filename, schedule: term.schedule })
    setLessons(term.lessons || {})
    setScaffolding(term.scaffolding || 'standard')
    setMode('full')
    setFullStep('schedule')
  }

  const crumbs = [
    { key: 'structure', label: 'Structure', active: ['structure', 'pacing', 'schedule', 'lesson'].includes(fullStep) },
    { key: 'schedule',  label: 'Schedule',  active: ['schedule', 'lesson'].includes(fullStep) },
    { key: 'lessons',   label: 'Lessons',   active: fullStep === 'lesson' },
  ]
  const showBreadcrumb = mode === 'full' && fullStep !== 'upload' && fullStep !== 'uploading'

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <a className="logo" href="/" onClick={e => { e.preventDefault(); reset() }} aria-label="LessonGrove home">
            <LogoMark />
            <span className="logo-text">LessonGrove</span>
          </a>

          {showBreadcrumb && (
            <nav className="breadcrumb" aria-label="Progress">
              {crumbs.map((c, i) => (
                <span key={c.key}>
                  {i > 0 && <span className="crumb-sep" aria-hidden="true">›</span>}
                  <span className={`crumb${c.active ? ' crumb--active' : ''}`}>{c.label}</span>
                </span>
              ))}
            </nav>
          )}

          {mode !== null && !showBreadcrumb && (
            <button className="header-home-btn" onClick={reset} aria-label="Back to home">
              ← Home
            </button>
          )}

          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      </header>

      <main className="main" id="main-content">

        {mode === null && (
          <Home
            onQuick={() => setMode('quick')}
            onFull={() => setMode('full')}
            onHistory={() => setMode('history')}
          />
        )}

        {mode === 'history' && (
          <History onRestoreTerm={handleRestoreTerm} onBack={reset} />
        )}

        {mode === 'quick' && (
          <QuickFlow onBack={reset} defaultScaffolding={scaffolding} />
        )}

        {mode === 'full' && fullStep === 'upload' && (
          <div className="upload-step">
            <div className="step-header">
              <p className="step-kicker">Step 1 of 3</p>
              <h1 className="step-title">Upload your textbook</h1>
              <p className="step-sub">
                LessonGrove will detect your book's chapter structure so you can review and edit it before building the schedule.
              </p>
            </div>
            <UploadForm onResult={handleUploadResult} disabled={false} />
            {error && <p className="error-banner" role="alert" style={{ marginTop: 12 }}>{error}</p>}
          </div>
        )}

        {mode === 'full' && fullStep === 'uploading' && (
          <div className="loading-state">
            <div className="spinner" role="status" aria-label="Analysing structure" />
            <p className="loading-title">Reading textbook structure…</p>
            <p className="loading-sub">Detecting chapters and page ranges. Takes a few seconds for large files.</p>
          </div>
        )}

        {mode === 'full' && fullStep === 'structure' && uploadData && (
          <div className="structure-step">
            <div className="step-header">
              <p className="step-kicker">Step 2 of 3 — Review detected structure</p>
              <h1 className="step-title">Does this look right?</h1>
              <p className="step-sub">
                Check that LessonGrove found the right chapters. Click any chapter title to rename it, or merge adjacent chapters.
              </p>
              {structureSaving && <p className="step-saving">Saving…</p>}
            </div>

            <div className="structure-layout">
              <StructureView
                data={uploadData}
                editable
                onStructureChange={handleStructureChange}
              />
              <aside className="structure-aside">
                <CourseForm
                  onSubmit={handlePace}
                  disabled={false}
                  defaultScaffolding={scaffolding}
                />
                {error && <p className="error-banner" role="alert" style={{ marginTop: 12 }}>{error}</p>}
              </aside>
            </div>
          </div>
        )}

        {mode === 'full' && fullStep === 'pacing' && (
          <div className="loading-state">
            <div className="spinner" role="status" aria-label="Building schedule" />
            <p className="loading-title">Building your schedule…</p>
          </div>
        )}

        {mode === 'full' && fullStep === 'schedule' && scheduleData && (
          <>
            {costEstimate && (
              <div className="cost-estimate-banner">
                Estimated cost to generate all {costEstimate.total_sessions} lessons:
                <strong> ~${costEstimate.estimated_cost_usd.toFixed(2)}</strong>
                <span className="cost-note"> ({costEstimate.note.split('.')[0]})</span>
              </div>
            )}
            <ScheduleGrid
              data={scheduleData}
              lessons={lessons}
              isGenerating={isGenerating}
              genProgress={genProgress}
              onGenerateLessons={handleGenerateLessons}
              onViewLesson={handleViewLesson}
              onReset={reset}
              error={error}
              scaffolding={scaffolding}
            />
          </>
        )}

        {mode === 'full' && fullStep === 'lesson' && activeLesson && (
          <LessonView
            lesson={activeLesson}
            onBack={handleBackToSchedule}
            onLessonUpdate={handleLessonUpdate}
            sessionId={uploadData?.session_id}
          />
        )}

      </main>
    </div>
  )
}
