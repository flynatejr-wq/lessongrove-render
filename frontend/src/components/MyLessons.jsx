import { useState, useMemo } from 'react'
import { getAllHistory } from '../history.js'

const TYPE_LABELS = {
  lesson: 'Lesson Plan',
  worksheet: 'Worksheet',
  problem_set: 'Problem Set',
  discussion_prompt: 'Discussion',
  project_brief: 'Project Brief',
  lecture_outline: 'Lecture Outline',
  essay_prompt: 'Essay Prompt',
  question_bank: 'Question Bank',
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function LessonCard({ lesson, termName, onView }) {
  const type = lesson.assignment_type || (lesson.activities ? 'lesson' : 'lesson')
  return (
    <button className="my-lessons-card" onClick={() => onView(lesson)}>
      <div className="my-lessons-card-top">
        <span className="my-lessons-type-tag">{TYPE_LABELS[type] || 'Lesson Plan'}</span>
        <span className="my-lessons-date">{formatDate(lesson.generated_at)}</span>
      </div>
      <h3 className="my-lessons-card-title">{lesson.title || `Session ${lesson.session_number}`}</h3>
      {termName && <p className="my-lessons-term">{termName}</p>}
      {lesson.objectives?.length > 0 && (
        <p className="my-lessons-preview">{lesson.objectives[0].text || lesson.objectives[0]}</p>
      )}
    </button>
  )
}

export default function MyLessons({ onViewLesson, onBack }) {
  const [query, setQuery] = useState('')
  const [filterType, setFilterType] = useState('all')

  const allTerms = useMemo(() => getAllHistory(), [])

  const allLessons = useMemo(() => {
    const result = []
    for (const term of allTerms) {
      for (const lesson of Object.values(term.lessons || {})) {
        result.push({ ...lesson, _termName: term.filename || 'Untitled course', _termId: term.id })
      }
    }
    return result.sort((a, b) => new Date(b.generated_at || 0) - new Date(a.generated_at || 0))
  }, [allTerms])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return allLessons.filter(l => {
      const matchesQuery = !q
        || (l.title || '').toLowerCase().includes(q)
        || (l._termName || '').toLowerCase().includes(q)
        || (l.objectives || []).some(o => (o.text || o).toLowerCase().includes(q))
      const matchesType = filterType === 'all' || (l.assignment_type || 'lesson') === filterType
      return matchesQuery && matchesType
    })
  }, [allLessons, query, filterType])

  return (
    <div className="my-lessons-page">
      <div className="my-lessons-header">
        <div>
          <h1 className="my-lessons-title">My Lessons</h1>
          <p className="my-lessons-sub">{allLessons.length} lesson{allLessons.length !== 1 ? 's' : ''} saved</p>
        </div>
      </div>

      <div className="my-lessons-controls">
        <div className="my-lessons-search-wrap">
          <svg className="my-lessons-search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="4.75" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            className="my-lessons-search"
            type="search"
            placeholder="Search by title, source, or objective…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search lessons"
          />
        </div>

        <div className="my-lessons-filters">
          {['all', 'lesson', 'worksheet', 'problem_set', 'discussion_prompt', 'project_brief'].map(t => (
            <button
              key={t}
              className={`my-lessons-filter-btn${filterType === t ? ' my-lessons-filter-btn--active' : ''}`}
              onClick={() => setFilterType(t)}
            >
              {t === 'all' ? 'All' : TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="my-lessons-empty">
          {allLessons.length === 0
            ? <>
                <p className="my-lessons-empty-title">No lessons yet</p>
                <p className="my-lessons-empty-sub">Generate a Quick Lesson or a full curriculum to see it here.</p>
              </>
            : <>
                <p className="my-lessons-empty-title">No results for "{query}"</p>
                <p className="my-lessons-empty-sub">Try a different search term or clear the filter.</p>
              </>
          }
        </div>
      ) : (
        <div className="my-lessons-grid">
          {filtered.map((l, i) => (
            <LessonCard
              key={`${l._termId}-${l.session_number}-${i}`}
              lesson={l}
              termName={l._termName}
              onView={onViewLesson}
            />
          ))}
        </div>
      )}
    </div>
  )
}
