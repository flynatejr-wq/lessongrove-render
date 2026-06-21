import { supabase } from './supabase.js'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

async function handleResponse(res) {
  if (!res.ok) {
    let msg
    try { const b = await res.json(); msg = b.detail || JSON.stringify(b) }
    catch { msg = await res.text() }
    throw new Error(msg || `Request failed (${res.status})`)
  }
  return res.json()
}

export async function uploadPDF(file) {
  const form = new FormData()
  form.append('file', file)
  return handleResponse(await fetch(`${BASE_URL}/upload`, {
    method: 'POST',
    headers: { ...(await authHeader()) },
    body: form,
  }))
}

export async function paceCurriculum(sessionId, totalWeeks, sessionsPerWeek, termStartDate = null, holidays = []) {
  return handleResponse(await fetch(`${BASE_URL}/pace`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({
      session_id: sessionId,
      total_weeks: totalWeeks,
      sessions_per_week: sessionsPerWeek,
      term_start_date: termStartDate,
      holidays,
    }),
  }))
}

export async function generateLessons(sessionId, onProgress, scaffolding = 'standard', standards = null, resume = false) {
  const res = await fetch(`${BASE_URL}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ session_id: sessionId, scaffolding, standards, resume }),
  })
  if (!res.ok) {
    let msg
    try { const b = await res.json(); msg = b.detail || JSON.stringify(b) }
    catch { msg = await res.text() }
    throw new Error(msg || `Generate failed (${res.status})`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes of silence = abort
  while (true) {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Stream timed out — no data received for 5 minutes.')), TIMEOUT_MS)
    )
    const { done, value } = await Promise.race([reader.read(), timeoutPromise])
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const json = line.slice(6).trim()
        if (json) onProgress(JSON.parse(json))
      }
    }
  }
}

export async function quickLesson(sessionId, startPage, endPage, title = 'Quick Lesson', scaffolding = 'standard', standards = null, outputType = 'lesson', assignmentType = 'worksheet') {
  return handleResponse(await fetch(`${BASE_URL}/quick-lesson`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ session_id: sessionId, start_page: startPage, end_page: endPage, title, scaffolding, standards, output_type: outputType, assignment_type: assignmentType }),
  }))
}

// ── Non-PDF ingestion ────────────────────────────────────────────────────────

export async function ingestText(text, title = 'Pasted text') {
  return handleResponse(await fetch(`${BASE_URL}/ingest/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ text, title }),
  }))
}

export async function ingestYoutube(url) {
  return handleResponse(await fetch(`${BASE_URL}/ingest/youtube`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ url }),
  }))
}

export async function ingestUrl(url) {
  return handleResponse(await fetch(`${BASE_URL}/ingest/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ url }),
  }))
}

export async function ingestDocx(file) {
  const form = new FormData()
  form.append('file', file)
  return handleResponse(await fetch(`${BASE_URL}/ingest/docx`, {
    method: 'POST',
    headers: { ...(await authHeader()) },
    body: form,
  }))
}

export async function ingestImage(file) {
  const form = new FormData()
  form.append('file', file)
  return handleResponse(await fetch(`${BASE_URL}/ingest/image`, {
    method: 'POST',
    headers: { ...(await authHeader()) },
    body: form,
  }))
}

export async function flagLesson(sessionId, sessionNumber, reason) {
  return handleResponse(await fetch(`${BASE_URL}/flag-lesson`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ session_id: sessionId, session_number: sessionNumber, reason }),
  }))
}

export async function regenerateSection(sessionId, sessionNumber, section, scaffolding = 'standard', standards = null) {
  return handleResponse(await fetch(`${BASE_URL}/regenerate-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ session_id: sessionId, session_number: sessionNumber, section, scaffolding, standards }),
  }))
}

export async function getCostEstimate(sessionId, totalSessions) {
  return handleResponse(await fetch(`${BASE_URL}/cost-estimate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ session_id: sessionId, total_sessions: totalSessions }),
  }))
}

export async function updateStructure(sessionId, chapters) {
  return handleResponse(await fetch(`${BASE_URL}/structure`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ session_id: sessionId, chapters }),
  }))
}
