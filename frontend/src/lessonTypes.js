// A saved entry can be a lesson plan, an assignment, or a professor output.
// Infer which from its shape so it opens in — and is labeled by — the right view.
export const PROF_KINDS = new Set(['lecture_outline', 'discussion_prompts', 'essay_prompt', 'question_bank'])

export function detectEntryKind(e) {
  if (!e) return 'lesson'
  if (e.assignment_type && Array.isArray(e.tasks)) return 'assignment'
  if (Array.isArray(e.sections)) return 'lecture_outline'
  if (Array.isArray(e.prompts)) return 'discussion_prompts'
  if (Array.isArray(e.rubric) || e.word_count_guidance) return 'essay_prompt'
  if (Array.isArray(e.questions)) return 'question_bank'
  return 'lesson'
}

const KIND_LABELS = {
  lesson: 'Lesson Plan',
  assignment: 'Assignment',
  lecture_outline: 'Lecture Outline',
  discussion_prompts: 'Discussion Questions',
  essay_prompt: 'Essay Question',
  question_bank: 'Question Bank',
}

const ASSIGNMENT_LABELS = {
  worksheet: 'Worksheet',
  problem_set: 'Problem Set',
  discussion_prompt: 'Discussion',
  project_brief: 'Project Brief',
}

// Human label for a saved entry (assignments resolve to their specific sub-type).
export function entryTypeLabel(e) {
  const kind = detectEntryKind(e)
  if (kind === 'assignment') return ASSIGNMENT_LABELS[e.assignment_type] || 'Assignment'
  return KIND_LABELS[kind] || 'Lesson Plan'
}
