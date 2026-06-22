// Shown above a created guide: lets the user generate another output type
// from the SAME chapter without re-picking the source.
export default function CompanionBar({ outputTypes, currentType, sourceTitle, onSelect }) {
  const others = outputTypes.filter(t => t.id !== currentType)
  if (others.length === 0) return null

  return (
    <div className="companion-bar">
      <div className="companion-bar-info">
        <span className="companion-bar-check" aria-hidden="true">✓</span>
        <div>
          <p className="companion-bar-title">
            Created from <strong>{sourceTitle}</strong>
          </p>
          <p className="companion-bar-sub">Need something else from this chapter?</p>
        </div>
      </div>
      <div className="companion-bar-actions">
        {others.map(t => (
          <button
            key={t.id}
            type="button"
            className="companion-chip"
            onClick={() => onSelect(t.id)}
          >
            + {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
