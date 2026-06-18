import { useRef, useState } from 'react'
import { uploadPDF } from '../api.js'

export default function UploadForm({ onResult, disabled }) {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState(null)
  const inputRef = useRef(null)

  function pick(f) {
    if (f?.name.toLowerCase().endsWith('.pdf')) setFile(f)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file || disabled) return
    onResult({ status: 'uploading' })
    try {
      const data = await uploadPDF(file)
      onResult({ status: 'done', data })
    } catch (err) {
      onResult({ status: 'error', message: err.message })
    }
  }

  return (
    <form className="upload-form" onSubmit={handleSubmit}>
      <div
        className={['dropzone', dragging && 'dropzone--active', file && 'dropzone--filled'].filter(Boolean).join(' ')}
        onClick={() => !file && inputRef.current.click()}
        onKeyDown={e => e.key === 'Enter' && !file && inputRef.current.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files[0]) }}
        tabIndex={file ? -1 : 0}
        role={file ? undefined : 'button'}
        aria-label={file ? undefined : 'Upload PDF — click or drag and drop'}
      >
        <input
          ref={inputRef} type="file" accept=".pdf" hidden
          onChange={e => pick(e.target.files[0])}
        />
        {file ? (
          <div className="dropzone-prompt">
            <span className="dropzone-icon" aria-hidden="true">📄</span>
            <span className="dropzone-filename">{file.name}</span>
            <button
              type="button" className="dropzone-clear" aria-label="Remove file"
              onClick={e => { e.stopPropagation(); setFile(null) }}
            >×</button>
          </div>
        ) : (
          <div>
            <div className="dropzone-prompt">
              <span className="dropzone-icon" aria-hidden="true">📤</span>
              <span className="dropzone-hint">Drop your textbook PDF here</span>
            </div>
            <p className="dropzone-sub">or click to browse · PDF only</p>
          </div>
        )}
      </div>

      <button
        className="btn-primary" type="submit"
        disabled={!file || disabled}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        Analyse structure →
      </button>
    </form>
  )
}
