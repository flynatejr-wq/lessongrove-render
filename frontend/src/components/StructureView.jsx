import { useState } from 'react'

export default function StructureView({
  data, selectable = false, editable = false,
  onSelect, selectedIdx = null, onStructureChange,
}) {
  const { filename, total_pages, structure } = data
  const { detection_method, warnings } = structure
  const [chapters, setChapters] = useState(structure.chapters)
  const [editingIdx, setEditingIdx] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [dirty, setDirty] = useState(false)

  const maxPages = Math.max(...chapters.map(ch => (ch.end_page ?? ch.start_page) - ch.start_page + 1), 1)

  function startEdit(idx) {
    setEditingIdx(idx)
    setEditTitle(chapters[idx].title)
  }

  function commitEdit(idx) {
    if (editTitle.trim() && editTitle !== chapters[idx].title) {
      const updated = chapters.map((ch, i) => i === idx ? { ...ch, title: editTitle.trim() } : ch)
      setChapters(updated)
      setDirty(true)
    }
    setEditingIdx(null)
  }

  function mergeWithNext(idx) {
    if (idx >= chapters.length - 1) return
    const a = chapters[idx]
    const b = chapters[idx + 1]
    const merged = {
      ...a,
      title: `${a.title} / ${b.title}`,
      end_page: b.end_page,
      sections: [...(a.sections || []), ...(b.sections || [])],
    }
    const updated = [...chapters.slice(0, idx), merged, ...chapters.slice(idx + 2)]
    setChapters(updated)
    setDirty(true)
  }

  function deleteChapter(idx) {
    if (chapters.length <= 1) return
    const updated = chapters.filter((_, i) => i !== idx)
    setChapters(updated)
    setDirty(true)
  }

  function saveChanges() {
    if (onStructureChange) onStructureChange(chapters)
    setDirty(false)
  }

  function resetChanges() {
    setChapters(structure.chapters)
    setDirty(false)
    setEditingIdx(null)
  }

  return (
    <div className="structure-main">
      <div className="structure-file">
        <span aria-hidden="true" style={{ fontSize: 20 }}>📖</span>
        <div>
          <div className="structure-filename">{filename}</div>
          <div className="structure-filemeta">{total_pages} pages · {chapters.length} chapters</div>
        </div>
        <span className="structure-method" title={`Detection method: ${detection_method}`}>
          {detection_method.replace('_', ' ')}
        </span>
      </div>

      {warnings?.length > 0 && (
        <div className="warnings">
          {warnings.map((w, i) => <p key={i} className="warn-banner">⚠ {w}</p>)}
        </div>
      )}

      {editable && dirty && (
        <div className="structure-edit-bar">
          <span className="structure-edit-note">Unsaved changes</span>
          <button className="btn-primary" style={{ fontSize: 13, padding: '6px 14px' }} onClick={saveChanges}>Save changes</button>
          <button className="btn-ghost" style={{ fontSize: 13 }} onClick={resetChanges}>Reset</button>
        </div>
      )}

      <div className="chapter-list" role={selectable ? 'listbox' : undefined} aria-label={selectable ? 'Select a chapter' : undefined}>
        {chapters.map((ch, i) => {
          const pageCount = (ch.end_page ?? ch.start_page) - ch.start_page + 1
          const barWidth = Math.round((pageCount / maxPages) * 100)
          const isSelected = selectedIdx === i
          const isEditing = editingIdx === i

          return (
            <div key={i}>
              <div
                className={[
                  'chapter-card',
                  selectable && 'chapter-card--selectable',
                  isSelected && 'chapter-card--selected',
                  editable && 'chapter-card--editable',
                ].filter(Boolean).join(' ')}
                onClick={selectable && !editable ? () => onSelect(i, ch) : undefined}
                onKeyDown={selectable && !editable ? e => e.key === 'Enter' && onSelect(i, ch) : undefined}
                tabIndex={selectable ? 0 : undefined}
                role={selectable ? 'option' : undefined}
                aria-selected={selectable ? isSelected : undefined}
              >
                <div className="chapter-card-header">
                  {ch.chapter_num != null && (
                    <span className="chapter-num">Ch. {ch.chapter_num}</span>
                  )}

                  {isEditing ? (
                    <input
                      className="chapter-title-input"
                      value={editTitle}
                      autoFocus
                      onChange={e => setEditTitle(e.target.value)}
                      onBlur={() => commitEdit(i)}
                      onKeyDown={e => { if (e.key === 'Enter') commitEdit(i); if (e.key === 'Escape') setEditingIdx(null) }}
                      aria-label="Edit chapter title"
                    />
                  ) : (
                    <span
                      className="chapter-title"
                      onClick={editable ? e => { e.stopPropagation(); startEdit(i) } : undefined}
                      title={editable ? 'Click to rename' : undefined}
                    >
                      {ch.title}
                      {editable && <span className="chapter-edit-icon" aria-hidden="true"> ✎</span>}
                    </span>
                  )}

                  <span className="chapter-pages">pp. {ch.start_page}–{ch.end_page ?? '?'}</span>

                  {editable && !isEditing && (
                    <div className="chapter-edit-actions">
                      {i < chapters.length - 1 && (
                        <button
                          className="chapter-action-btn"
                          onClick={e => { e.stopPropagation(); mergeWithNext(i) }}
                          title="Merge with next chapter"
                          aria-label={`Merge chapter ${i + 1} with chapter ${i + 2}`}
                        >
                          Merge ↓
                        </button>
                      )}
                      {chapters.length > 1 && (
                        <button
                          className="chapter-action-btn chapter-action-btn--danger"
                          onClick={e => { e.stopPropagation(); deleteChapter(i) }}
                          title="Remove this chapter"
                          aria-label={`Remove chapter ${i + 1}`}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="chapter-bar-wrap">
                  <div className="chapter-bar-bg" role="presentation">
                    <div className="chapter-bar-fill" style={{ width: `${barWidth}%` }} />
                  </div>
                  <span className="chapter-page-count">{pageCount} pp</span>
                </div>

                {ch.sections?.length > 0 && (
                  <div className="section-list">
                    {ch.sections.map((s, j) => (
                      <div key={j} className="section-item">
                        <span>{s.title}</span>
                        <span className="section-page">p. {s.start_page}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selectable mode: chapter click */}
              {selectable && editable && (
                <button
                  className={`chapter-select-btn${isSelected ? ' chapter-select-btn--active' : ''}`}
                  onClick={() => onSelect(i, ch)}
                >
                  {isSelected ? '✓ Selected' : 'Use this chapter'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
