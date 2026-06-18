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

export async function paceCurriculum(sessionId, totalWeeks, sessionsPerWeek) {
  return handleResponse(await fetch(`${BASE_URL}/pace`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, total_weeks: totalWeeks, sessions_per_week: sessionsPerWeek }),
  }))
}

export async function generateLessons(sessionId, onProgress) {
  const res = await fetch(`${BASE_URL}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
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

export async function quickLesson(sessionId, startPage, endPage, title = 'Quick Lesson') {
  return handleResponse(await fetch(`${BASE_URL}/quick-lesson`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, start_page: startPage, end_page: endPage, title }),
  }))
}
