import json
import anthropic
from app.config import settings
from app.schemas import LessonPlan, KeyConcept, Activity, AssessmentQuestion, SessionSlot, PageContent

_MAX_TEXT_CHARS = 60_000  # ~15k tokens — fits comfortably in claude-sonnet-4-6 context


def _extract_text(pages: list[PageContent], start_page: int, end_page: int) -> str:
    chunks = [
        p.text for p in pages
        if start_page <= p.page_num <= end_page and p.text.strip()
    ]
    text = "\n\n".join(chunks)
    if len(text) > _MAX_TEXT_CHARS:
        text = text[:_MAX_TEXT_CHARS] + "\n\n[... text truncated for length ...]"
    return text


_LESSON_SCHEMA = """
{
  "title": "string — concise lesson title derived from the content",
  "learning_objectives": ["string", "..."],
  "key_concepts": [{"term": "string", "definition": "string"}, "..."],
  "activities": [{"title": "string", "description": "string", "duration_minutes": integer_or_null}, "..."],
  "assessment_questions": [{"question": "string", "type": "discussion|written|short_answer"}, "..."],
  "homework": "string or null"
}
"""

_PROMPT_TEMPLATE = """\
You are an expert educator writing a lesson plan for a teacher.

LESSON CONTEXT
- Week {week}, Day {day} (Session {session_num} of {total_sessions})
- Textbook pages {start_page}–{end_page}
- Sections covered: {sections}

TEXTBOOK EXCERPT
{text}

---

INSTRUCTIONS
1. Write a structured lesson plan STRICTLY grounded in the textbook excerpt above.
2. Do NOT introduce any facts, examples, or content not present in the excerpt.
3. Include 3–5 learning objectives (what students will be able to do).
4. Include 4–8 key concepts with definitions drawn from the text.
5. Include 2–4 classroom activities (include realistic time estimates).
6. Include 4–6 assessment questions. Mark discussion questions as "discussion", written prompts as "written", and recall/comprehension checks as "short_answer".
7. Optionally include one homework assignment grounded in the text, or null.
8. Reference page numbers in activity and assessment descriptions where relevant.

Return ONLY valid JSON matching this schema exactly — no markdown fences, no extra text:
{schema}
"""


def generate_lesson(
    slot: SessionSlot,
    pages: list[PageContent],
    total_sessions: int,
) -> LessonPlan:
    text = _extract_text(pages, slot.start_page, slot.end_page)
    sections = ", ".join(u.title for u in slot.units) or "Full document"

    prompt = _PROMPT_TEMPLATE.format(
        week=slot.week_number,
        day=slot.day_number,
        session_num=slot.session_number,
        total_sessions=total_sessions,
        start_page=slot.start_page,
        end_page=slot.end_page,
        sections=sections,
        text=text if text.strip() else "(No extractable text for these pages.)",
        schema=_LESSON_SCHEMA,
    )

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    # Strip markdown fences if the model added them despite instructions
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    data = json.loads(raw)

    return LessonPlan(
        session_number=slot.session_number,
        week_number=slot.week_number,
        day_number=slot.day_number,
        title=data.get("title", sections),
        page_range=f"pp. {slot.start_page}–{slot.end_page}",
        source_sections=[u.title for u in slot.units],
        learning_objectives=data.get("learning_objectives", []),
        key_concepts=[KeyConcept(**kc) for kc in data.get("key_concepts", [])],
        activities=[Activity(**a) for a in data.get("activities", [])],
        assessment_questions=[AssessmentQuestion(**q) for q in data.get("assessment_questions", [])],
        homework=data.get("homework"),
    )
