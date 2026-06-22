import { useState } from 'react'

const USER_TYPES = [
  {
    id: 'k12',
    title: 'K-12 Teacher',
    description: 'I plan lessons and units, usually from one textbook or set of materials per class',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="4" y="6" width="24" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M4 11h24" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M10 6V4M22 6V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M9 16h6M9 20h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'professor',
    title: 'College Professor',
    description: 'I work from a syllabus, multiple sources, and need rubrics, question banks, and formal assessment tools',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M16 4L4 10l12 6 12-6-12-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M4 10v8M28 10v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M8 14v6a8 4 0 0016 0v-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'tutor',
    title: 'Tutor / Independent',
    description: 'I work one-on-one or in small groups from varied materials and flexible schedules',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <circle cx="12" cy="10" r="4" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="22" cy="13" r="3" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M4 26c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M22 20c2.761 0 5 2.015 5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
]

const ALL_LEVELS = [
  { value: 'elementary',    label: 'Elementary (K–5)',   types: ['k12', 'tutor'] },
  { value: 'middle',        label: 'Middle School (6–8)', types: ['k12', 'tutor'] },
  { value: 'high',          label: 'High School (9–12)',  types: ['k12', 'tutor'] },
  { value: 'undergraduate', label: 'Undergraduate',       types: ['professor', 'tutor'] },
  { value: 'masters',       label: 'Graduate / Masters',  types: ['professor', 'tutor'] },
  { value: 'phd',           label: 'PhD',                 types: ['professor', 'tutor'] },
]

function getLevels(userType) {
  if (!userType) return []
  return ALL_LEVELS.filter(l => l.types.includes(userType))
}

const STANDARDS = [
  { value: '', label: 'Standards framework…' },
  { value: 'common_core', label: 'US Common Core' },
  { value: 'ngss', label: 'US Next Gen Science (NGSS)' },
  { value: 'uk_national', label: 'UK National Curriculum' },
  { value: 'australian', label: 'Australian Curriculum v9' },
  { value: 'nz', label: 'NZ Curriculum' },
  { value: 'custom', label: 'Custom / institutional' },
  { value: 'none', label: 'None' },
]

export default function Onboarding({ onComplete }) {
  const [selected, setSelected] = useState(null)
  const [subject, setSubject] = useState('')
  const [level, setLevel] = useState('')
  const [standards, setStandards] = useState('')

  function handleSelectType(id) {
    setSelected(id)
    setLevel('') // reset level when type changes
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!selected) return
    onComplete({ userType: selected, subject: subject.trim(), level, standards })
  }

  return (
    <div className="onboarding">
      <div className="onboarding-inner">
        <div className="onboarding-header">
          <h1 className="onboarding-title">How do you teach?</h1>
          <p className="onboarding-sub">This helps LessonGrove show you the right tools from the start. You can change it any time in Settings.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="user-type-cards" role="radiogroup" aria-label="User type">
            {USER_TYPES.map(t => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={selected === t.id}
                className={`user-type-card${selected === t.id ? ' user-type-card--selected' : ''}`}
                onClick={() => handleSelectType(t.id)}
              >
                <span className="user-type-icon">{t.icon}</span>
                <span className="user-type-title">{t.title}</span>
                <span className="user-type-desc">{t.description}</span>
                {selected === t.id && (
                  <span className="user-type-check" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7.25" stroke="var(--ember)" strokeWidth="1.5"/>
                      <path d="M4.5 8l2.5 2.5 4.5-5" stroke="var(--ember)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                )}
              </button>
            ))}
          </div>

          {selected && (
            <div className="onboarding-fields">
              <input
                className="onboarding-input"
                type="text"
                placeholder="Subject or discipline (e.g. Biology, World History, Calculus)"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                aria-label="Subject"
                autoFocus
              />
              <div className="onboarding-selects">
                <select
                  className="onboarding-select"
                  value={level}
                  onChange={e => setLevel(e.target.value)}
                  aria-label="Student level"
                >
                  <option value="">Student level…</option>
                  {getLevels(selected).map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
                <select
                  className="onboarding-select"
                  value={standards}
                  onChange={e => setStandards(e.target.value)}
                  aria-label="Standards framework"
                >
                  {STANDARDS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
          )}

          <button
            className="onboarding-cta"
            type="submit"
            disabled={!selected}
          >
            Set up my workspace →
          </button>
        </form>
      </div>
    </div>
  )
}
