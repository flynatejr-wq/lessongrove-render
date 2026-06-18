import { useState } from 'react'
import UploadForm from './UploadForm.jsx'
import StructureView from './StructureView.jsx'
import LessonView from './LessonView.jsx'
import { quickLesson } from '../api.js'

export default function QuickFlow({ onBack }) {
  const [step, setStep] = useState('upload')   // upload | configure | generating | result
  const [uploadData, setUploadData] = useState(null)
  const [selectedChapterIdx, setSelectedChapterIdx] = useState(null)
  const [startPage, setStartPage] = useState('')
  const [endPage, setEndPage] = useState('')
  const [lesson, setLesson] = useState(null)
  const [error, setError] = useState(null)

  function handleUploadResult(result) {
    if (result.status === 'uploading') {
      setStep('uploading')
      setError(null)
    } else if (result.status === 'done') {
      setUploadData(result.data)
      setStep('configure')
    } else {
      setError(result.message)
      setStep('upload')
    }
  }

  function handleChapterSelect(idx, chapter) {
    setSelectedChapterIdx(idx)
    setStartPage(String(chapter.start_page))
    setEndPage(String(chapter.end_page ?? chapter.start_page))
  }

  function clearChapterSelection() {
    setSelectedChapterIdx(null)
    setStartPage('')
    setEndPage('')
  }

  async function handleGenerate() {
    const start = parseInt(startPage, 10)
    const end = parseInt(endPage, 10)
    const total = uploadData.total_pages

    if (!start || !end || start < 1 || end > total || start > end) {
      setError(`Enter a valid page range between 1 and ${total}.`)
      return
    }
    setError(null)
    setStep('generating')
    try {
      const title = selectedChapterIdx !== null
        ? uploadData.structure.chapters[selectedChapterIdx]?.title
        : `Pages ${start}–${end}`
      const result = await quickLesson(uploadData.session_id, start, end, title)
      setLesson(result)
      setStep('result')
    } catch (err) {
      setError(err.message)
      setStep('configure')
    }
  }

  if (step === 'result' && lesson) {
    return (
      <LessonView
        lesson={lesson}
        isQuick
        onBack={() => setStep('configure')}
      />
    )
  }

  return (
    <div className="quick-step">
      <div className="step-header">
        <p className="step-kicker">Quick lesson</p>
        <h1 className="step-title">
          {step === 'upload' || step === 'uploading'
            ? 'Upload your textbook'
            : step === 'generating'
            ? 'Writing your lesson plan…'
            : 'Choose what to cover'}
        </h1>
        {step === 'configure' && (
          <p className="step-sub">
            Select a chapter below, or enter a page range directly.
          </p>
        )}
      </div>

      {step === 'upload' && (
        <div className="quick-step--upload">
          <UploadForm onResult={handleUploadResult} disabled={false} />
          {error && <p className="error-banner" role="alert" style={{ marginTop: 12 }}>{error}</p>}
        </div>
      )}

      {step === 'uploading' && (
        <div className="loading-state">
          <div className="spinner" role="status" aria-label="Analysing structure" />
          <p className="loading-title">Reading textbook structure…</p>
          <p className="loading-sub">Detecting chapters and page ranges. This takes a few seconds for large files.</p>
        </div>
      )}

      {step === 'generating' && (
        <div className="loading-state">
          <div className="spinner" role="status" aria-label="Generating lesson" />
          <p className="loading-title">Writing your lesson plan…</p>
          <p className="loading-sub">LessonGrove is reading the pages and grounding every section in your textbook's actual content.</p>
        </div>
      )}

      {step === 'configure' && uploadData && (
        <div className="quick-configure">
          <StructureView
            data={uploadData}
            selectable
            onSelect={handleChapterSelect}
            selectedIdx={selectedChapterIdx}
          />

          <div className="quick-or">— or enter a custom page range —</div>

          <div className="quick-range">
            <span className="quick-range-label">Pages</span>
            <input
              type="number" className="quick-range-input"
              min={1} max={uploadData.total_pages}
              value={startPage}
              onChange={e => { setStartPage(e.target.value); clearChapterSelection() }}
              placeholder="1"
              aria-label="Start page"
            />
            <span className="quick-range-sep" aria-hidden="true">to</span>
            <input
              type="number" className="quick-range-input"
              min={1} max={uploadData.total_pages}
              value={endPage}
              onChange={e => { setEndPage(e.target.value); clearChapterSelection() }}
              placeholder={String(uploadData.total_pages)}
              aria-label="End page"
            />
            <span className="quick-range-label" style={{ marginLeft: 4 }}>
              of {uploadData.total_pages}
            </span>
          </div>

          {error && <p className="error-banner" role="alert" style={{ marginTop: 12 }}>{error}</p>}

          <div className="quick-actions">
            <button className="btn-primary" onClick={handleGenerate}
              disabled={!startPage && selectedChapterIdx === null}>
              Generate lesson →
            </button>
            <button className="btn-ghost" onClick={() => { setStep('upload'); setUploadData(null); setSelectedChapterIdx(null); setStartPage(''); setEndPage(''); setError(null) }}>
              Upload different PDF
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
