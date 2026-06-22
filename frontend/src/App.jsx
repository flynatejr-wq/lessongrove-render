import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'
import Home from './components/Home.jsx'
import GeneratingLoader from './components/GeneratingLoader.jsx'
import Onboarding from './components/Onboarding.jsx'
import LandingPage from './components/auth/LandingPage.jsx'
import SignUp from './components/auth/SignUp.jsx'
import LogIn from './components/auth/LogIn.jsx'
import QuickFlow from './components/QuickFlow.jsx'
import UploadForm from './components/UploadForm.jsx'
import StructureView from './components/StructureView.jsx'
import CourseForm from './components/CourseForm.jsx'
import ScheduleGrid from './components/ScheduleGrid.jsx'
import LessonView from './components/LessonView.jsx'
import MyLessons from './components/MyLessons.jsx'
import Settings from './components/Settings.jsx'
import ResetPassword from './components/auth/ResetPassword.jsx'
import { paceCurriculum, generateLessons, updateStructure, getCostEstimate } from './api.js'
import { saveTermToHistory, getAllHistory, deleteFromHistory } from './history.js'

const SETTINGS_KEY = 'lessongrove_settings'
const THEME_KEY = 'lessongrove_theme'
const PROFILE_KEY = 'lessongrove_profile'

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {} } catch { return {} }
}
function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch {}
}
function loadProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) } catch { return null }
}
function saveProfile(p) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)) } catch {}
}
function userFromSupabase(sbUser) {
  if (!sbUser) return null
  return { id: sbUser.id, email: sbUser.email, name: sbUser.user_metadata?.name || sbUser.email.split('@')[0] }
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
      <rect width="32" height="32" rx="6" fill="#b8862a"/>
      <rect x="4"    y="20" width="7" height="8"  fill="white"/>
      <rect x="12.5" y="12" width="7" height="16" fill="white"/>
      <rect x="21"   y="4"  width="7" height="24" fill="white"/>
    </svg>
  )
}

// Pages / modes
const PAGES = {
  HOME: 'home',
  QUICK: 'quick',
  CURRICULUM: 'curriculum',
  MY_LESSONS: 'my_lessons',
  SETTINGS: 'settings',
}

export default function App() {
  const [theme, setTheme] = useState(getInitialTheme)
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [profile, setProfile] = useState(loadProfile)
  const [authScreen, setAuthScreen] = useState('landing') // 'landing' | 'signup' | 'login'
  const [signupMode, setSignupMode] = useState('quick')
  const [fromSignup, setFromSignup] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [authError, setAuthError] = useState(null)
  const [page, setPage] = useState(PAGES.HOME)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pageKey, setPageKey] = useState(0)
  const [newPulse, setNewPulse] = useState(
    () => { try { return !localStorage.getItem('lg_new_clicked') } catch { return true } }
  )

  function stopNewPulse() {
    setNewPulse(false)
    try { localStorage.setItem('lg_new_clicked', '1') } catch {}
  }

  function handleSignupRequest(mode = 'quick') {
    setSignupMode(mode)
    setAuthScreen('signup')
  }

  useEffect(() => {
    // Catch expired/invalid confirmation or reset links: Supabase redirects
    // back with #error=...&error_description=... in the URL hash.
    const hash = window.location.hash
    if (hash.includes('error')) {
      const params = new URLSearchParams(hash.replace(/^#/, ''))
      const desc = params.get('error_description')
      if (desc) {
        setAuthError(desc.replace(/\+/g, ' '))
        window.history.replaceState(null, '', window.location.pathname)
      }
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(userFromSupabase(session?.user ?? null))
      setAuthReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(userFromSupabase(session?.user ?? null))
      setAuthReady(true)
      if (event === 'PASSWORD_RECOVERY') setResetMode(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  function handleSignupComplete(newUser) {
    setUser(newUser)
    setFromSignup(true)
    // profile not yet set → will show Onboarding
  }

  function handleLoginComplete(existingUser) {
    setUser(existingUser)
    setFromSignup(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setAuthScreen('landing')
  }

  async function handleDeleteAccount() {
    try { localStorage.removeItem(PROFILE_KEY) } catch {}
    try { localStorage.removeItem('lessongrove_history') } catch {}
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setAuthScreen('landing')
  }

  // Full curriculum state
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

  function toggleTheme() { setTheme(t => t === 'dark' ? 'light' : 'dark') }

  function handleOnboardingComplete(data) {
    const p = { ...data, scaffolding: 'standard' }
    saveProfile(p)
    setProfile(p)
    setScaffolding(p.scaffolding)
    setFromSignup(false)
    if (signupMode === 'curriculum') setPage(PAGES.CURRICULUM)
    else if (signupMode === 'quick') setPage(PAGES.QUICK)
  }

  function handleSaveSettings(data) {
    const p = { ...profile, ...data }
    saveProfile(p)
    setProfile(p)
    if (data.scaffolding) setScaffolding(data.scaffolding)
  }

  function handleClearHistory() {
    const all = getAllHistory()
    all.forEach(t => deleteFromHistory(t.id))
    try { localStorage.removeItem('lessongrove_history') } catch {}
  }

  function navigate(p) {
    setPage(p)
    setPageKey(k => k + 1)
    setMenuOpen(false)
    if (p !== PAGES.CURRICULUM) {
      setFullStep('upload'); setUploadData(null); setScheduleData(null)
      setLessons({}); setActiveLesson(null); setError(null); setCostEstimate(null)
    }
  }

  function resetCurriculum() {
    setFullStep('upload'); setUploadData(null); setScheduleData(null)
    setLessons({}); setIsGenerating(false); setGenProgress(null)
    setActiveLesson(null); setError(null); setCostEstimate(null)
  }

  // Full curriculum handlers
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
    } finally { setStructureSaving(false) }
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
    } catch (err) { setError(err.message); setFullStep('structure') }
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
        scaffolding, null, hasExisting,
      )
    } catch (err) { setError(err.message) }
    finally {
      setIsGenerating(false); setGenProgress(null)
      if (sseErrors.length > 0) {
        setError(sseErrors.length === 1
          ? `Lesson generation failed: ${sseErrors[0]}`
          : `${sseErrors.length} lessons failed. First error: ${sseErrors[0]}`)
      }
      const allLessons = { ...lessons, ...newLessons }
      if (Object.keys(allLessons).length > 0 && scheduleData) {
        saveTermToHistory({
          id: uploadData.session_id, filename: uploadData.filename,
          savedAt: new Date().toISOString(), weeks: scheduleData.schedule.total_weeks,
          sessionsPerWeek: scheduleData.schedule.sessions_per_week,
          scaffolding, schedule: scheduleData.schedule, lessons: allLessons,
        })
      }
    }
  }

  function handleViewLesson(lesson) { setActiveLesson(lesson); setFullStep('lesson') }
  function handleBackToSchedule() { setActiveLesson(null); setFullStep('schedule') }
  function handleLessonUpdate(updatedLesson) {
    setLessons(prev => ({ ...prev, [updatedLesson.session_number]: updatedLesson }))
    setActiveLesson(updatedLesson)
  }
  function handleRestoreTerm(term) {
    setUploadData({ session_id: term.id, filename: term.filename, structure: term.schedule })
    setScheduleData({ filename: term.filename, schedule: term.schedule })
    setLessons(term.lessons || {})
    setScaffolding(term.scaffolding || 'standard')
    setPage(PAGES.CURRICULUM)
    setFullStep('schedule')
  }

  // Breadcrumbs for curriculum flow
  const crumbs = [
    { key: 'structure', label: '1. Structure', active: ['structure','pacing','schedule','lesson'].includes(fullStep) },
    { key: 'schedule',  label: '2. Schedule',  active: ['schedule','lesson'].includes(fullStep) },
    { key: 'lessons',   label: '3. Lessons',   active: fullStep === 'lesson' },
  ]
  const showBreadcrumb = page === PAGES.CURRICULUM && !['upload','uploading'].includes(fullStep)

  // ── Password reset: Supabase sent user back with recovery token ──
  if (authReady && resetMode) {
    return (
      <div className="app" data-theme={theme}>
        <ResetPassword onDone={() => { setResetMode(false); window.history.replaceState(null, '', '/') }} />
      </div>
    )
  }

  // ── Auth loading: wait for Supabase session check ────────────
  if (!authReady) {
    return (
      <div className="app" data-theme={theme}>
        <div className="auth-boot-loader" aria-label="Loading…" />
      </div>
    )
  }

  // ── Unauthenticated: landing / sign up / log in ──────────────
  if (!user) {
    return (
      <div className="app" data-theme={theme}>
        {authError && (
          <div className="auth-error-toast" role="alert">
            <span>{authError}</span>
            <button className="auth-error-close" onClick={() => setAuthError(null)} aria-label="Dismiss">×</button>
          </div>
        )}
        {authScreen === 'landing' && (
          <LandingPage
            onSignup={handleSignupRequest}
            onLogin={() => setAuthScreen('login')}
          />
        )}
        {authScreen === 'signup' && (
          <SignUp
            signupMode={signupMode}
            onComplete={handleSignupComplete}
            onLogin={() => setAuthScreen('login')}
          />
        )}
        {authScreen === 'login' && (
          <LogIn
            onComplete={handleLoginComplete}
            onSignup={() => handleSignupRequest('quick')}
          />
        )}
      </div>
    )
  }

  // ── Authenticated but no profile: onboarding ─────────────────
  if (!profile) {
    return (
      <div className="app" data-theme={theme}>
        <header className="header">
          <div className="header-inner">
            <span className="logo"><LogoMark /><span className="logo-text">LessonGrove</span></span>
            <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? '☀' : '☾'}
            </button>
          </div>
        </header>
        <main className="main">
          {fromSignup && (
            <div className="onboarding-steps">
              <div className="onboarding-step-track">
                <div className="onboarding-step-dot onboarding-step-dot--done">✓</div>
                <div className="onboarding-step-line" />
                <div className="onboarding-step-dot onboarding-step-dot--active">2</div>
              </div>
              <p className="onboarding-step-label">Step 2 of 2 — Set up your workspace</p>
            </div>
          )}
          <Onboarding onComplete={handleOnboardingComplete} />
        </main>
      </div>
    )
  }

  const navLinks = [
    { id: PAGES.QUICK,      label: 'Quick Lesson' },
    { id: PAGES.CURRICULUM, label: 'Full Curriculum' },
    { id: PAGES.MY_LESSONS, label: 'My Lessons' },
    { id: PAGES.SETTINGS,   label: 'Settings' },
  ]

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <a className="logo" href="/" onClick={e => { e.preventDefault(); navigate(PAGES.HOME) }} aria-label="LessonGrove home">
            <LogoMark />
            <span className="logo-text">LessonGrove</span>
          </a>

          <nav className="main-nav" aria-label="Main navigation">
            {navLinks.map(l => (
              <button
                key={l.id}
                className={`nav-link${page === l.id ? ' nav-link--active' : ''}`}
                onClick={() => navigate(l.id)}
              >
                {l.label}
              </button>
            ))}
          </nav>

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

          <div className="header-right">
            <button
              className={`btn-new${newPulse && page === PAGES.HOME ? ' btn-new--pulse' : ''}`}
              onClick={() => { stopNewPulse(); navigate(PAGES.QUICK) }}
              aria-label="New quick lesson"
            >
              + New
            </button>
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
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
            <button
              className="hamburger"
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              <span/><span/><span/>
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="mobile-menu" aria-label="Mobile navigation">
            {navLinks.map(l => (
              <button
                key={l.id}
                className={`mobile-nav-link${page === l.id ? ' mobile-nav-link--active' : ''}`}
                onClick={() => navigate(l.id)}
              >
                {l.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="main" id="main-content">
        <div key={pageKey} className="page-content">

        {page === PAGES.HOME && (
          <Home
            onQuick={() => navigate(PAGES.QUICK)}
            onFull={() => navigate(PAGES.CURRICULUM)}
            onHistory={() => navigate(PAGES.MY_LESSONS)}
          />
        )}

        {page === PAGES.QUICK && (
          <QuickFlow onBack={() => navigate(PAGES.HOME)} defaultScaffolding={scaffolding} />
        )}

        {page === PAGES.MY_LESSONS && (
          <MyLessons
            onViewLesson={lesson => { setActiveLesson(lesson); setPage(PAGES.MY_LESSONS) }}
            onBack={() => navigate(PAGES.HOME)}
          />
        )}

        {page === PAGES.SETTINGS && (
          <Settings
            profile={{ ...profile, scaffolding }}
            theme={theme}
            onSave={handleSaveSettings}
            onThemeToggle={toggleTheme}
            onClearHistory={handleClearHistory}
            onSignOut={handleSignOut}
            onDeleteAccount={handleDeleteAccount}
          />
        )}

        {page === PAGES.CURRICULUM && fullStep === 'upload' && (
          <div className="upload-step">
            <div className="step-header">
              <p className="step-kicker">Step 1 of 3</p>
              <h1 className="step-title">Upload your textbook</h1>
              <p className="step-sub">LessonGrove will detect your book's chapter structure so you can review and edit it before building the schedule.</p>
            </div>
            <UploadForm onResult={handleUploadResult} disabled={false} />
            {error && <p className="error-banner" role="alert" style={{ marginTop: 12 }}>{error}</p>}
          </div>
        )}

        {page === PAGES.CURRICULUM && fullStep === 'uploading' && (
          <GeneratingLoader outputType="structure" title="Reading textbook structure…" />
        )}

        {page === PAGES.CURRICULUM && fullStep === 'structure' && uploadData && (
          <div className="structure-step">
            <div className="step-header">
              <p className="step-kicker">Step 2 of 3 — Review detected structure</p>
              <h1 className="step-title">Does this look right?</h1>
              <p className="step-sub">Check that LessonGrove found the right chapters. Click any chapter title to rename it, or merge adjacent chapters.</p>
              {structureSaving && <p className="step-saving">Saving…</p>}
            </div>
            <div className="structure-layout">
              <StructureView data={uploadData} editable onStructureChange={handleStructureChange} />
              <aside className="structure-aside">
                <CourseForm onSubmit={handlePace} disabled={false} defaultScaffolding={scaffolding} />
                {error && <p className="error-banner" role="alert" style={{ marginTop: 12 }}>{error}</p>}
              </aside>
            </div>
          </div>
        )}

        {page === PAGES.CURRICULUM && fullStep === 'pacing' && (
          <GeneratingLoader outputType="curriculum" title="Building your schedule…" />
        )}

        {page === PAGES.CURRICULUM && fullStep === 'schedule' && scheduleData && (
          <>
            {costEstimate && (
              <div className="cost-estimate-banner">
                Estimated cost to generate all {costEstimate.total_sessions} lessons:
                <strong> ~${costEstimate.estimated_cost_usd.toFixed(2)}</strong>
                <span className="cost-note"> ({costEstimate.note.split('.')[0]})</span>
              </div>
            )}
            <ScheduleGrid
              data={scheduleData} lessons={lessons} isGenerating={isGenerating}
              genProgress={genProgress} onGenerateLessons={handleGenerateLessons}
              onViewLesson={handleViewLesson} onReset={resetCurriculum}
              error={error} scaffolding={scaffolding}
            />
          </>
        )}

        {page === PAGES.CURRICULUM && fullStep === 'lesson' && activeLesson && (
          <LessonView
            lesson={activeLesson} onBack={handleBackToSchedule}
            onLessonUpdate={handleLessonUpdate} sessionId={uploadData?.session_id}
          />
        )}

        </div>
      </main>
    </div>
  )
}
