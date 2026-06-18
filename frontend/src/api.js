const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

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
  return handleResponse(await fetch(`${BASE_URL}/upload`, { method: 'POST', body: form }))
}

export async function paceCurriculum(sessionId, totalWeeks, sessionsPerWeek, termStartDate = null, holidays = []) {
  return handleResponse(await fetch(`${BASE_URL}/pace`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
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
  while (true) {
    const { done, value } = await reader.read()
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

export async function quickLesson(sessionId, startPage, endPage, title = 'Quick Lesson', scaffolding = 'standard', standards = null) {
  return handleResponse(await fetch(`${BASE_URL}/quick-lesson`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, start_page: startPage, end_page: endPage, title, scaffolding, standards }),
  }))
}

export async function flagLesson(sessionId, sessionNumber, reason) {
  return handleResponse(await fetch(`${BASE_URL}/flag-lesson`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, session_number: sessionNumber, reason }),
  }))
}

export async function regenerateSection(sessionId, sessionNumber, section, scaffolding = 'standard', standards = null) {
  return handleResponse(await fetch(`${BASE_URL}/regenerate-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, session_number: sessionNumber, section, scaffolding, standards }),
  }))
}

export async function getCostEstimate(sessionId, totalSessions) {
  return handleResponse(await fetch(`${BASE_URL}/cost-estimate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, total_sessions: totalSessions }),
  }))
}

export async function updateStructure(sessionId, chapters) {
  return handleResponse(await fetch(`${BASE_URL}/structure`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, chapters }),
  }))
}
