import { useState, useRef } from 'react'
import { uploadPDF, ingestText, ingestYoutube, ingestUrl, ingestDocx, ingestImage } from '../api.js'

const SOURCE_TYPES = [
  { id: 'pdf',     label: 'PDF',        icon: '📄', hint: 'Textbook or any PDF document' },
  { id: 'text',    label: 'Text',       icon: '✏️', hint: 'Paste or type notes, articles, or any content' },
  { id: 'image',   label: 'Image',      icon: '🖼', hint: 'Photo of a whiteboard, diagram, or textbook page' },
  { id: 'youtube', label: 'YouTube',    icon: '▶', hint: 'Paste a YouTube video link' },
  { id: 'url',     label: 'Web article',icon: '🔗', hint: 'Paste any webpage or article URL' },
  { id: 'docx',    label: 'Word doc',   icon: '📝', hint: 'Upload a .docx file' },
]
const PRIMARY_IDS = ['pdf', 'text', 'image']

export default function SourcePicker({ onIngested, onBack }) {
  const [sourceType, setSourceType] = useState('pdf')
  const [showMore, setShowMore] = useState(false)
  const [text, setText] = useState('')
  const [textTitle, setTextTitle] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [droppedName, setDroppedName] = useState(null)
  const fileRef = useRef(null)

  function handleDragOver(e) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave() {
    setDragOver(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const dt = new DataTransfer()
    dt.items.add(file)
    fileRef.current.files = dt.files
    setDroppedName(file.name)
  }

  const dropProps = {
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
  }

  const selected = SOURCE_TYPES.find(s => s.id === sourceType)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      let result
      switch (sourceType) {
        case 'pdf': {
          const file = fileRef.current?.files?.[0]
          if (!file) throw new Error('Please select a PDF file.')
          result = await uploadPDF(file)
          // uploadPDF returns UploadResponse shape; normalise to IngestResponse shape
          result = { ...result, content_type: 'pdf' }
          break
        }
        case 'text': {
          if (!text.trim()) throw new Error('Please paste or type some content.')
          result = await ingestText(text.trim(), textTitle.trim() || 'Pasted text')
          break
        }
        case 'youtube': {
          if (!url.trim()) throw new Error('Please enter a YouTube URL.')
          result = await ingestYoutube(url.trim())
          break
        }
        case 'url': {
          if (!url.trim()) throw new Error('Please enter a URL.')
          result = await ingestUrl(url.trim())
          break
        }
        case 'docx': {
          const file = fileRef.current?.files?.[0]
          if (!file) throw new Error('Please select a .docx file.')
          result = await ingestDocx(file)
          break
        }
        case 'image': {
          const file = fileRef.current?.files?.[0]
          if (!file) throw new Error('Please select an image file.')
          result = await ingestImage(file)
          break
        }
        default:
          throw new Error('Unknown source type.')
      }
      onIngested({ sourceType, data: result })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="source-picker">
      {/* Type tabs — lead with the common sources, tuck the rest behind "More" */}
      <div className="source-tabs" role="tablist" aria-label="Source type">
        {SOURCE_TYPES.filter(s => PRIMARY_IDS.includes(s.id) || showMore).map(s => (
          <button
            key={s.id}
            role="tab"
            aria-selected={sourceType === s.id}
            className={`source-tab${sourceType === s.id ? ' source-tab--active' : ''}`}
            onClick={() => { setSourceType(s.id); setError(null); setUrl(''); setDroppedName(null) }}
          >
            <span className="source-tab-icon" aria-hidden="true">{s.icon}</span>
            <span className="source-tab-label">{s.label}</span>
          </button>
        ))}
        {!showMore && (
          <button
            type="button"
            className="source-tab source-tab--more"
            onClick={() => setShowMore(true)}
            aria-label="Show more source types"
          >
            <span className="source-tab-icon" aria-hidden="true">⋯</span>
            <span className="source-tab-label">More</span>
          </button>
        )}
      </div>

      <p className="source-hint">{selected.hint}</p>

      <form onSubmit={handleSubmit} className="source-form">

        {(sourceType === 'pdf') && (
          <label className={`file-drop${dragOver ? ' file-drop--over' : ''}`} {...dropProps}>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,application/pdf"
              className="file-drop-input"
              aria-label="Upload PDF"
              onChange={e => setDroppedName(e.target.files?.[0]?.name || null)}
            />
            <span className="file-drop-label">
              <span className="file-drop-icon" aria-hidden="true">📄</span>
              {droppedName
                ? <span><strong>{droppedName}</strong> — ready</span>
                : <span>Drop a PDF here or <strong>browse</strong></span>}
            </span>
          </label>
        )}

        {sourceType === 'text' && (
          <div className="source-text-wrap">
            <input
              className="source-text-title"
              type="text"
              placeholder="Title (optional)"
              value={textTitle}
              onChange={e => setTextTitle(e.target.value)}
              aria-label="Content title"
            />
            <textarea
              className="source-textarea"
              placeholder="Paste or type the content you want to teach from…"
              value={text}
              onChange={e => setText(e.target.value)}
              rows={10}
              aria-label="Source text"
            />
            <p className="source-char-count">{text.length.toLocaleString()} characters</p>
          </div>
        )}

        {(sourceType === 'youtube' || sourceType === 'url') && (
          <input
            className="source-url-input"
            type="url"
            placeholder={sourceType === 'youtube' ? 'https://www.youtube.com/watch?v=…' : 'https://…'}
            value={url}
            onChange={e => setUrl(e.target.value)}
            aria-label={sourceType === 'youtube' ? 'YouTube URL' : 'Web URL'}
            autoFocus
          />
        )}

        {sourceType === 'docx' && (
          <label className={`file-drop${dragOver ? ' file-drop--over' : ''}`} {...dropProps}>
            <input
              ref={fileRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="file-drop-input"
              aria-label="Upload Word document"
              onChange={e => setDroppedName(e.target.files?.[0]?.name || null)}
            />
            <span className="file-drop-label">
              <span className="file-drop-icon" aria-hidden="true">📝</span>
              {droppedName
                ? <span><strong>{droppedName}</strong> — ready</span>
                : <span>Drop a .docx file here or <strong>browse</strong></span>}
            </span>
          </label>
        )}

        {sourceType === 'image' && (
          <label className={`file-drop${dragOver ? ' file-drop--over' : ''}`} {...dropProps}>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="file-drop-input"
              aria-label="Upload image"
              onChange={e => setDroppedName(e.target.files?.[0]?.name || null)}
            />
            <span className="file-drop-label">
              <span className="file-drop-icon" aria-hidden="true">🖼</span>
              {droppedName
                ? <span><strong>{droppedName}</strong> — ready</span>
                : <span>Drop an image here or <strong>browse</strong> (JPEG, PNG, WebP)</span>}
            </span>
          </label>
        )}

        {error && <p className="error-banner" role="alert" style={{ marginTop: 12 }}>{error}</p>}

        <div className="source-actions">
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading
              ? (sourceType === 'image' ? 'Extracting with Claude…' : 'Loading…')
              : 'Use this source →'}
          </button>
          {onBack && (
            <button type="button" className="btn-ghost" onClick={onBack}>← Back</button>
          )}
        </div>
      </form>
    </div>
  )
}
