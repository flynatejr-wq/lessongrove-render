import { useState, useMemo } from 'react'
import { getAllHistory, deleteLessonFromTerm } from '../history.js'
import { detectEntryKind, entryTypeLabel } from '../lessonTypes.js'

const KIND_ORDER = ['lesson', 'assignment', 'lecture_outline', 'discussion_prompts', 'essay_prompt', 'question_bank']
const KIND_FILTER_LABELS = {
  lesson: 'Lessons',
  assignment: 'Assignments',
  lecture_outline: 'Lecture Outlines',
  discussion_prompts: 'Discussion Qs',
  essay_prompt: 'Essay Qs',
  question_bank: 'Question Banks',
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function previewText(l) {
  return l.learning_objectives?.[0]?.text
    || (typeof l.learning_objectives?.[0] === 'string' ? l.learning_objectives[0] : null)
    || l.overview
    || l.prompt
    || ''
}

function LessonCard({ lesson, termName, onView, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const label = entryTypeLabel(lesson)
  const preview = previewText(lesson)

  return (
    <div className="my-lessons-card-wrap">
      <button className="my-lessons-card" onClick={() => onView(lesson)}>
        <div className="my-lessons-card-top">
          <span className="my-lessons-type-tag">{label}</span>
          <span className="my-lessons-date">{formatDate(lesson.generated_at)}</span>
        </div>
        <h3 className="my-lessons-card-title">{lesson.title || `Session ${lesson.session_number}`}</h3>
        {termName && <p className="my-lessons-term">{termName}</p>}
        {preview && <p className="my-lessons-preview">{preview}</p>}
      </button>

      {confirming ? (
        <div className="my-lessons-card-confirm" role="group" aria-label="Confirm delete">
          <button className="my-lessons-card-confirm-yes" onClick={() => onDelete(lesson)}>Delete</button>
          <button className="my-lessons-card-confirm-no" onClick={() => setConfirming(false)}>Cancel</button>
        </div>
      ) : (
        <button
          className="my-lessons-card-delete"
          onClick={() => setConfirming(true)}
          aria-label={`Delete ${lesson.title || 'this lesson'}`}
        >×</button>
      )}
    </div>
  )
}

export default function MyLessons({ onViewLesson, onBack, onCreate }) {
  const [query, setQuery] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [terms, setTerms] = useState(() => getAllHistory())

  const allLessons = useMemo(() => {
    const result = []
    for (const term of terms) {
      for (const lesson of Object.values(term.lessons || {})) {
        result.push({ ...lesson, _termName: term.filename || 'Untitled course', _termId: term.id })
      }
    }
    return result.sort((a, b) => new Date(b.generated_at || 0) - new Date(a.generated_at || 0))
  }, [terms])

  const presentKinds = useMemo(() => {
    const set = new Set(allLessons.map(detectEntryKind))
    return KIND_ORDER.filter(k => set.has(k))
  }, [allLessons])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return allLessons.filter(l => {
      const matchesQuery = !q
        || (l.title || '').toLowerCase().includes(q)
        || (l._termName || '').toLowerCase().includes(q)
        || previewText(l).toLowerCase().includes(q)
      const matchesType = filterType === 'all' || detectEntryKind(l) === filterType
      return matchesQuery && matchesType
    })
  }, [allLessons, query, filterType])

  function handleDelete(lesson) {
    const next = deleteLessonFromTerm(lesson._termId, lesson.session_number)
    setTerms(next)
  }

  return (
    <div className="my-lessons-page">
      <div className="my-lessons-header">
        <div>
          <h1 className="my-lessons-title">My Lessons</h1>
          <p className="my-lessons-sub">{allLessons.length} item{allLessons.length !== 1 ? 's' : ''} saved</p>
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
            placeholder="Search by title, source, or content…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search lessons"
          />
        </div>

        {presentKinds.length > 1 && (
          <div className="my-lessons-filters">
            {['all', ...presentKinds].map(t => (
              <button
                key={t}
                className={`my-lessons-filter-btn${filterType === t ? ' my-lessons-filter-btn--active' : ''}`}
                onClick={() => setFilterType(t)}
              >
                {t === 'all' ? 'All' : KIND_FILTER_LABELS[t]}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="my-lessons-empty">
          {allLessons.length === 0
            ? <>
                <p className="my-lessons-empty-title">No lessons yet</p>
                <p className="my-lessons-empty-sub">Generate a Quick Lesson or a full curriculum to see it here.</p>
                {onCreate && (
                  <button className="btn-primary" style={{ marginTop: 16 }} onClick={onCreate}>
                    Create your first lesson →
                  </button>
                )}
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
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
