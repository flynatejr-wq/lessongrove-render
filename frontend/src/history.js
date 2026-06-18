const HISTORY_KEY = 'lessongrove_history'
const MAX_HISTORY = 20

export function saveTermToHistory({ id, filename, savedAt, weeks, sessionsPerWeek, scaffolding, schedule, lessons }) {
  const entry = { id, filename, savedAt, weeks, sessionsPerWeek, scaffolding, schedule, lessons }
  const history = getAllHistory().filter(t => t.id !== id)
  history.unshift(entry)
  if (history.length > MAX_HISTORY) history.splice(MAX_HISTORY)
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)) } catch {}
}

export function getAllHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [] } catch { return [] }
}

export function searchHistory(query) {
  const q = query.trim().toLowerCase()
  if (!q) return getAllHistory()
  return getAllHistory().filter(term => {
    if (term.filename?.toLowerCase().includes(q)) return true
    return Object.values(term.lessons || {}).some(lesson => {
      if (lesson.title?.toLowerCase().includes(q)) return true
      if (lesson.source_sections?.some(s => s.toLowerCase().includes(q))) return true
      return (lesson.learning_objectives || []).some(obj => {
        const text = typeof obj === 'string' ? obj : obj.text
        return text?.toLowerCase().includes(q)
      })
    })
  })
}

export function deleteFromHistory(id) {
  const history = getAllHistory().filter(t => t.id !== id)
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)) } catch {}
  return history
}

export function hasHistory() {
  return getAllHistory().length > 0
}
