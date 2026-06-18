export default function StructureView({ data, selectable = false, onSelect, selectedIdx = null }) {
  const { filename, total_pages, structure } = data
  const { detection_method, chapters, warnings } = structure

  const maxPages = Math.max(...chapters.map(ch => (ch.end_page ?? ch.start_page) - ch.start_page + 1), 1)

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

      <div className="chapter-list" role={selectable ? 'listbox' : undefined} aria-label={selectable ? 'Select a chapter' : undefined}>
        {chapters.map((ch, i) => {
          const pageCount = (ch.end_page ?? ch.start_page) - ch.start_page + 1
          const barWidth = Math.round((pageCount / maxPages) * 100)
          const isSelected = selectedIdx === i

          return (
            <div
              key={i}
              className={[
                'chapter-card',
                selectable && 'chapter-card--selectable',
                isSelected && 'chapter-card--selected',
              ].filter(Boolean).join(' ')}
              onClick={selectable ? () => onSelect(i, ch) : undefined}
              onKeyDown={selectable ? e => e.key === 'Enter' && onSelect(i, ch) : undefined}
              tabIndex={selectable ? 0 : undefined}
              role={selectable ? 'option' : undefined}
              aria-selected={selectable ? isSelected : undefined}
            >
              <div className="chapter-card-header">
                {ch.chapter_num != null && (
                  <span className="chapter-num">Ch. {ch.chapter_num}</span>
                )}
                <span className="chapter-title">{ch.title}</span>
                <span className="chapter-pages">pp. {ch.start_page}–{ch.end_page ?? '?'}</span>
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
          )
        })}
      </div>
    </div>
  )
}
