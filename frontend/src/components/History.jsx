import { useState, useEffect } from 'react'
import { searchHistory, deleteFromHistory } from '../history.js'

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function History({ onRestoreTerm, onBack }) {
  const [query, setQuery] = useState('')
  const [terms, setTerms] = useState([])

  useEffect(() => {
    setTerms(searchHistory(query))
  }, [query])

  function handleDelete(id, e) {
    e.stopPropagation()
    if (!window.confirm('Remove this term from history?')) return
    setTerms(deleteFromHistory(id))
  }

  return (
    <div className="history-view">
      <div className="step-header">
        <p className="step-kicker">Your saved terms</p>
        <h1 className="step-title">Lesson history</h1>
        <p className="step-sub">Generated curricula saved in this browser. Search by filename, chapter, or keyword.</p>
      </div>

      <div className="history-search-wrap">
        <input
          className="history-search"
          type="search"
          placeholder="Search by title, chapter, or keyword…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Search history"
        />
      </div>

      {terms.length === 0 ? (
        <div className="history-empty">
          {query ? (
            <p>No results for <strong>"{query}"</strong>.</p>
          ) : (
            <p>No saved terms yet. Generate a full curriculum and it'll appear here automatically.</p>
          )}
        </div>
      ) : (
        <div className="history-list">
          {terms.map(term => {
            const lessonCount = Object.keys(term.lessons || {}).length
            return (
              <div
                key={term.id}
                className="history-card"
                onClick={() => onRestoreTerm(term)}
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && onRestoreTerm(term)}
                role="button"
                aria-label={`Restore ${term.filename}`}
              >
                <div className="history-card-main">
                  <span className="history-filename">{term.filename}</span>
                  <span className="history-meta">
                    {term.weeks}w · {term.sessionsPerWeek}/wk · {term.schedule?.total_sessions ?? 0} sessions · {lessonCount} lessons generated
                    {term.scaffolding && term.scaffolding !== 'standard' && <> · <span style={{ textTransform: 'capitalize' }}>{term.scaffolding}</span></>}
                  </span>
                  <span className="history-date">Saved {formatDate(term.savedAt)}</span>
                </div>
                <div className="history-card-actions">
                  <button
                    className="history-delete-btn"
                    onClick={e => handleDelete(term.id, e)}
                    aria-label="Delete from history"
                    title="Remove from history"
                  >✕</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 32 }}>
        <button className="btn-ghost" onClick={onBack}>← Back to home</button>
      </div>
    </div>
  )
}
