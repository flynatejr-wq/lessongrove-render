import json
import anthropic
from app.config import settings
from app.schemas import LessonPlan, LearningObjective, KeyConcept, Activity, AssessmentQuestion, SessionSlot, PageContent

_MAX_TEXT_CHARS = 60_000  # ~15k tokens — fits comfortably in claude-sonnet-4-6 context

# Claude Sonnet 4.6 pricing (per 1M tokens)
INPUT_PRICE_PER_M  = 3.00
OUTPUT_PRICE_PER_M = 15.00
AVG_INPUT_TOKENS   = 15_000   # prompt + textbook excerpt
AVG_OUTPUT_TOKENS  = 2_000    # structured JSON lesson plan


def _extract_text(pages: list[PageContent], start_page: int, end_page: int) -> str:
    chunks = [
        p.text for p in pages
        if start_page <= p.page_num <= end_page and p.text.strip()
    ]
    text = "\n\n".join(chunks)
    if len(text) > _MAX_TEXT_CHARS:
        text = text[:_MAX_TEXT_CHARS] + "\n\n[... text truncated for length ...]"
    return text


def estimate_cost(total_sessions: int) -> dict:
    input_tokens  = total_sessions * AVG_INPUT_TOKENS
    output_tokens = total_sessions * AVG_OUTPUT_TOKENS
    cost = (input_tokens / 1_000_000 * INPUT_PRICE_PER_M
            + output_tokens / 1_000_000 * OUTPUT_PRICE_PER_M)
    return {
        "total_sessions": total_sessions,
        "estimated_input_tokens": input_tokens,
        "estimated_output_tokens": output_tokens,
        "estimated_cost_usd": round(cost, 4),
        "model": "claude-sonnet-4-6",
        "note": "Estimate based on average 15k input + 2k output tokens per session. Actual cost varies with textbook density.",
    }


_SCAFFOLDING_INSTRUCTIONS = {
    "light": (
        "SCAFFOLDING LEVEL: Light support. Assume students can handle independent challenge. "
        "Activities should include open-ended inquiry and higher-order thinking. "
        "Minimise pre-teaching; let students discover through the text. "
        "Assessment questions should push for analysis and synthesis, not just recall."
    ),
    "standard": (
        "SCAFFOLDING LEVEL: Standard support. Balance direct instruction with student practice. "
        "Include a mix of guided and independent activities. "
        "Assessment questions should span recall, application, and some analysis."
    ),
    "heavy": (
        "SCAFFOLDING LEVEL: Heavy support. Break every concept into small, explicit steps. "
        "Activities should include worked examples, sentence starters, and graphic organisers. "
        "Use check-for-understanding questions throughout. "
        "Assessment questions should start with recall and comprehension before moving to application."
    ),
}

_STANDARDS_INSTRUCTIONS = {
    "US Common Core": "Align learning objectives to US Common Core State Standards where applicable. Reference the relevant standard code (e.g. CCSS.ELA-LITERACY.RH.9-10.1) in each objective.",
    "UK National Curriculum": "Align learning objectives to the UK National Curriculum. Reference the relevant Key Stage and subject strand in each objective.",
    "Australian Curriculum v9": "Align learning objectives to the Australian Curriculum v9. Reference the relevant content descriptions and achievement standards.",
    "NZ Curriculum": "Align learning objectives to The New Zealand Curriculum. Reference the relevant learning area, strand, and level.",
    "IB MYP": "Align learning objectives to the IB Middle Years Programme. Reference the relevant subject group criteria and command terms.",
    "IB DP": "Align learning objectives to the IB Diploma Programme. Reference the relevant subject guide learning objectives.",
}

_LESSON_SCHEMA = """
{
  "title": "string — concise lesson title derived from the content",
  "learning_objectives": [{"text": "string", "page_ref": integer_or_null}, "..."],
  "key_concepts": [{"term": "string", "definition": "string", "page_ref": integer_or_null}, "..."],
  "activities": [{"title": "string", "description": "string", "duration_minutes": integer_or_null, "page_ref": integer_or_null}, "..."],
  "assessment_questions": [{"question": "string", "type": "discussion|written|short_answer", "page_ref": integer_or_null}, "..."],
  "homework": "string or null"
}
"""

_PROMPT_TEMPLATE = """\
You are an expert educator writing a lesson plan for a teacher.

LESSON CONTEXT
- Week {week}, Day {day} (Session {session_num} of {total_sessions})
- Textbook pages {start_page}–{end_page}
- Sections covered: {sections}
{prior_context}
SCAFFOLDING & STANDARDS
{scaffolding_instruction}
{standards_instruction}
TEXTBOOK EXCERPT
{text}

---

INSTRUCTIONS
1. Write a structured lesson plan STRICTLY grounded in the textbook excerpt above.
2. Do NOT introduce any facts, examples, or content not present in the excerpt.
3. Include 3–5 learning objectives (what students will be able to do after this lesson).
4. Include 4–8 key concepts with definitions drawn directly from the text.
5. Include 2–4 classroom activities with realistic time estimates.
6. Include 4–6 assessment questions. Mark discussion questions as "discussion", written prompts as "written", recall/comprehension as "short_answer".
7. Optionally include one homework assignment grounded in the text, or null.
8. For EVERY item in learning_objectives, activities, and assessment_questions, set page_ref to the exact page number in the excerpt where that content appears. If it spans multiple pages, use the first. If unsure, use null.
9. Apply the scaffolding level above consistently across all sections.

Return ONLY valid JSON matching this schema exactly — no markdown fences, no extra text:
{schema}
"""

_SECTION_PROMPT_TEMPLATE = """\
You are an expert educator regenerating one section of an existing lesson plan.

LESSON CONTEXT
- Session {session_num}, Week {week}, Day {day}
- Textbook pages {start_page}–{end_page}
- Sections covered: {sections}
- Lesson title: {title}

SCAFFOLDING: {scaffolding_instruction}
{standards_instruction}

TEXTBOOK EXCERPT
{text}

---

TASK: Regenerate ONLY the "{section}" section of this lesson plan.
Ground every item strictly in the textbook excerpt. Do not introduce outside facts.
{section_instruction}

Return ONLY valid JSON for that section — no markdown fences, no extra text.
"""

_SECTION_SCHEMAS = {
    "learning_objectives": '{"learning_objectives": [{"text": "string", "page_ref": integer_or_null}, "..."]}',
    "key_concepts": '{"key_concepts": [{"term": "string", "definition": "string", "page_ref": integer_or_null}, "..."]}',
    "activities": '{"activities": [{"title": "string", "description": "string", "duration_minutes": integer_or_null, "page_ref": integer_or_null}, "..."]}',
    "assessment_questions": '{"assessment_questions": [{"question": "string", "type": "discussion|written|short_answer", "page_ref": integer_or_null}, "..."]}',
    "homework": '{"homework": "string or null"}',
}

_SECTION_INSTRUCTIONS = {
    "learning_objectives": "Include 3–5 objectives (what students will be able to do).",
    "key_concepts": "Include 4–8 key concepts with definitions drawn from the text.",
    "activities": "Include 2–4 classroom activities with time estimates in minutes.",
    "assessment_questions": "Include 4–6 questions spanning recall, application, and analysis.",
    "homework": "One homework assignment grounded in the text, or null.",
}


def generate_lesson(
    slot: SessionSlot,
    pages: list[PageContent],
    total_sessions: int,
    scaffolding_level: str = "standard",
    standards_framework: str | None = None,
    prior_context: str = "",
) -> LessonPlan:
    text = _extract_text(pages, slot.start_page, slot.end_page)
    sections = ", ".join(u.title for u in slot.units) or "Full document"

    scaffolding_instruction = _SCAFFOLDING_INSTRUCTIONS.get(scaffolding_level, _SCAFFOLDING_INSTRUCTIONS["standard"])
    standards_instruction = _STANDARDS_INSTRUCTIONS.get(standards_framework, "") if standards_framework else ""
    prior_block = f"\nTERM CONTEXT (already covered)\n{prior_context}\n" if prior_context else ""

    prompt = _PROMPT_TEMPLATE.format(
        week=slot.week_number,
        day=slot.day_number,
        session_num=slot.session_number,
        total_sessions=total_sessions,
        start_page=slot.start_page,
        end_page=slot.end_page,
        sections=sections,
        prior_context=prior_block,
        scaffolding_instruction=scaffolding_instruction,
        standards_instruction=standards_instruction,
        text=text if text.strip() else "(No extractable text for these pages.)",
        schema=_LESSON_SCHEMA,
    )

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    data = json.loads(raw)

    raw_objs = data.get("learning_objectives", [])
    objectives = [
        LearningObjective(text=o) if isinstance(o, str) else LearningObjective(**o)
        for o in raw_objs
    ]

    return LessonPlan(
        schema_version="1.1",
        session_number=slot.session_number,
        week_number=slot.week_number,
        day_number=slot.day_number,
        title=data.get("title", sections),
        page_range=f"pp. {slot.start_page}–{slot.end_page}",
        source_sections=[u.title for u in slot.units],
        scaffolding_level=scaffolding_level,
        standards_framework=standards_framework,
        learning_objectives=objectives,
        key_concepts=[KeyConcept(**kc) for kc in data.get("key_concepts", [])],
        activities=[Activity(**a) for a in data.get("activities", [])],
        assessment_questions=[AssessmentQuestion(**q) for q in data.get("assessment_questions", [])],
        homework=data.get("homework"),
    )


def regenerate_section(
    slot: SessionSlot,
    pages: list[PageContent],
    lesson_title: str,
    section: str,
    scaffolding_level: str = "standard",
    standards_framework: str | None = None,
) -> dict:
    if section not in _SECTION_SCHEMAS:
        raise ValueError(f"Unknown section: {section}")

    text = _extract_text(pages, slot.start_page, slot.end_page)
    sections = ", ".join(u.title for u in slot.units) or "Full document"
    scaffolding_instruction = _SCAFFOLDING_INSTRUCTIONS.get(scaffolding_level, _SCAFFOLDING_INSTRUCTIONS["standard"])
    standards_instruction = _STANDARDS_INSTRUCTIONS.get(standards_framework, "") if standards_framework else ""

    prompt = _SECTION_PROMPT_TEMPLATE.format(
        session_num=slot.session_number,
        week=slot.week_number,
        day=slot.day_number,
        start_page=slot.start_page,
        end_page=slot.end_page,
        sections=sections,
        title=lesson_title,
        scaffolding_instruction=scaffolding_instruction,
        standards_instruction=standards_instruction,
        text=text if text.strip() else "(No extractable text for these pages.)",
        section=section,
        section_instruction=_SECTION_INSTRUCTIONS[section],
    ) + f"\nSchema: {_SECTION_SCHEMAS[section]}"

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    return json.loads(raw)
