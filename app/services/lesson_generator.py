import json
import anthropic
from app.config import settings
from app.schemas import (
    LessonPlan, LearningObjective, KeyConcept, Activity, AssessmentQuestion,
    SessionSlot, PageContent, Assignment, AssignmentTask,
    LectureOutline, LectureSection, LecturePoint,
    DiscussionPrompts, DiscussionPromptItem,
    EssayPrompt, RubricCriterion,
    QuestionBank, QuestionBankItem,
)

_MAX_TEXT_CHARS = 60_000  # ~15k tokens — fits comfortably in claude-sonnet-4-6 context

# Claude Sonnet 4.6 pricing (per 1M tokens)
INPUT_PRICE_PER_M  = 3.00
OUTPUT_PRICE_PER_M = 15.00
AVG_INPUT_TOKENS   = 15_000   # prompt + textbook excerpt
AVG_OUTPUT_TOKENS  = 2_000    # structured JSON lesson plan


def _extract_all_text(pages: list[PageContent]) -> str:
    """Extract all text from a session (for non-PDF sources)."""
    chunks = [p.text for p in pages if p.text.strip()]
    text = "\n\n".join(chunks)
    if len(text) > _MAX_TEXT_CHARS:
        text = text[:_MAX_TEXT_CHARS] + "\n\n[... text truncated for length ...]"
    return text


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


_ASSIGNMENT_SCHEMA = """
{
  "title": "string — concise assignment title",
  "overview": "string — 2-3 sentence teacher-facing description of what students will do and why",
  "tasks": [
    {"number": 1, "prompt": "string — the actual student-facing task or question", "page_ref": integer_or_null},
    ...
  ]
}
"""

_ASSIGNMENT_TYPE_INSTRUCTIONS = {
    "worksheet": "Create a worksheet with 6–10 questions or structured tasks that guide students through the content step by step. Mix recall, comprehension, and application questions.",
    "problem_set": "Create a problem set with 5–8 practice problems or exercises derived directly from the source content. Each problem should require students to apply a concept from the material.",
    "discussion_prompt": "Create 3–5 rich discussion prompts that require students to engage critically with the source content. Each prompt should be open-ended and invite multiple perspectives.",
    "project_brief": "Create a project brief with a compelling central challenge rooted in the source content. Include a clear deliverable, 4–6 specific tasks or milestones, and success criteria.",
}

_ASSIGNMENT_PROMPT = """\
You are an expert educator creating a student-facing assignment for a teacher.

SOURCE CONTENT
{source_description}

SCAFFOLDING & STANDARDS
{scaffolding_instruction}
{standards_instruction}

SOURCE EXCERPT
{text}

---

INSTRUCTIONS
1. Create a {assignment_type_label} strictly grounded in the source excerpt above.
2. Do NOT introduce any facts, examples, or content not present in the excerpt.
3. {type_instruction}
4. For each task, set page_ref to the page/chunk number in the excerpt where that content appears (or null if it spans multiple sections).
5. Apply the scaffolding level consistently — adjust difficulty, complexity, and support offered accordingly.
6. The assignment must be entirely student-facing (not a lesson plan).

Return ONLY valid JSON matching this schema — no markdown fences, no extra text:
{schema}
"""

_ASSIGNMENT_TYPE_LABELS = {
    "worksheet": "worksheet",
    "problem_set": "problem set",
    "discussion_prompt": "set of discussion prompts",
    "project_brief": "project brief",
}


def generate_assignment(
    slot: SessionSlot,
    pages: list[PageContent],
    scaffolding_level: str = "standard",
    standards_framework: str | None = None,
    assignment_type: str = "worksheet",
    content_type: str = "pdf",
) -> Assignment:
    if content_type == "pdf":
        text = _extract_text(pages, slot.start_page, slot.end_page)
        source_ref = f"pp. {slot.start_page}–{slot.end_page}"
        source_description = f"Textbook pages {slot.start_page}–{slot.end_page}"
    else:
        text = _extract_all_text(pages)
        source_ref = "Full document"
        source_description = f"Source material ({content_type})"

    sections = ", ".join(u.title for u in slot.units) or "Full document"
    scaffolding_instruction = _SCAFFOLDING_INSTRUCTIONS.get(scaffolding_level, _SCAFFOLDING_INSTRUCTIONS["standard"])
    standards_instruction = _STANDARDS_INSTRUCTIONS.get(standards_framework, "") if standards_framework else ""
    type_instruction = _ASSIGNMENT_TYPE_INSTRUCTIONS.get(assignment_type, _ASSIGNMENT_TYPE_INSTRUCTIONS["worksheet"])
    type_label = _ASSIGNMENT_TYPE_LABELS.get(assignment_type, assignment_type.replace("_", " "))

    prompt = _ASSIGNMENT_PROMPT.format(
        source_description=source_description,
        scaffolding_instruction=scaffolding_instruction,
        standards_instruction=standards_instruction,
        text=text if text.strip() else "(No extractable text.)",
        assignment_type_label=type_label,
        type_instruction=type_instruction,
        schema=_ASSIGNMENT_SCHEMA,
    )

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=3000,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    data = json.loads(raw)

    return Assignment(
        schema_version="1.2",
        session_number=slot.session_number,
        week_number=slot.week_number,
        day_number=slot.day_number,
        title=data.get("title", sections),
        assignment_type=assignment_type,
        source_ref=source_ref,
        source_sections=[u.title for u in slot.units],
        scaffolding_level=scaffolding_level,
        standards_framework=standards_framework,
        overview=data.get("overview", ""),
        tasks=[AssignmentTask(**t) for t in data.get("tasks", [])],
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


# ── Professor output types ────────────────────────────────────────────────────

def _prof_text(pages, slot, content_type):
    if content_type == "pdf":
        return _extract_text(pages, slot.start_page, slot.end_page), f"pp. {slot.start_page}–{slot.end_page}"
    return _extract_all_text(pages), "Full document"


def _llm(prompt, max_tokens=3000):
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = msg.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return json.loads(raw)


def generate_lecture_outline(
    slot: SessionSlot,
    pages: list[PageContent],
    scaffolding_level: str = "standard",
    standards_framework: str | None = None,
    content_type: str = "pdf",
) -> LectureOutline:
    text, source_ref = _prof_text(pages, slot, content_type)
    sc = _SCAFFOLDING_INSTRUCTIONS.get(scaffolding_level, _SCAFFOLDING_INSTRUCTIONS["standard"])
    st = _STANDARDS_INSTRUCTIONS.get(standards_framework, "") if standards_framework else ""
    schema = '''{"title":"string","overview":"string","sections":[{"heading":"string","duration_minutes":int_or_null,"points":[{"text":"string","page_ref":int_or_null}]}]}'''
    prompt = f"""You are an expert educator writing a lecture outline for a college professor.

SOURCE: {source_ref}
{sc}
{st}

SOURCE EXCERPT
{text or "(No extractable text.)"}

---

INSTRUCTIONS
1. Write a structured lecture outline grounded STRICTLY in the excerpt above. No outside facts.
2. Create 4–7 outline sections, each with a clear heading and 3–6 talking points.
3. Each talking point must be a complete sentence a professor could speak directly.
4. Include estimated duration_minutes per section (total 45–90 min for a typical class).
5. Set page_ref on each talking point to the source page where that content appears.
6. The overview (2–3 sentences) is professor-facing context for the session.

Return ONLY valid JSON: {schema}"""
    data = _llm(prompt, max_tokens=3500)
    return LectureOutline(
        session_number=slot.session_number, week_number=slot.week_number,
        title=data["title"], source_ref=source_ref,
        scaffolding_level=scaffolding_level, standards_framework=standards_framework,
        overview=data.get("overview", ""),
        sections=[
            LectureSection(
                heading=s["heading"], duration_minutes=s.get("duration_minutes"),
                points=[LecturePoint(**p) for p in s.get("points", [])]
            ) for s in data.get("sections", [])
        ],
    )


def generate_discussion_prompts(
    slot: SessionSlot,
    pages: list[PageContent],
    scaffolding_level: str = "standard",
    standards_framework: str | None = None,
    content_type: str = "pdf",
) -> DiscussionPrompts:
    text, source_ref = _prof_text(pages, slot, content_type)
    sc = _SCAFFOLDING_INSTRUCTIONS.get(scaffolding_level, _SCAFFOLDING_INSTRUCTIONS["standard"])
    schema = '''{"title":"string","overview":"string","prompts":[{"prompt":"string","follow_ups":["string"],"page_ref":int_or_null}]}'''
    prompt = f"""You are an expert educator writing seminar discussion prompts for a college professor.

SOURCE: {source_ref}
{sc}

SOURCE EXCERPT
{text or "(No extractable text.)"}

---

INSTRUCTIONS
1. Create 4–6 rich discussion prompts grounded STRICTLY in the excerpt. No outside facts.
2. Each prompt must be open-ended, invite multiple perspectives, and require engagement with the text.
3. Include 2–3 follow-up questions per prompt for when discussion stalls.
4. Set page_ref to the source page most relevant to each prompt.
5. The overview (1–2 sentences) is professor-facing context.

Return ONLY valid JSON: {schema}"""
    data = _llm(prompt, max_tokens=2500)
    return DiscussionPrompts(
        session_number=slot.session_number, week_number=slot.week_number,
        title=data["title"], source_ref=source_ref,
        scaffolding_level=scaffolding_level, standards_framework=standards_framework,
        overview=data.get("overview", ""),
        prompts=[DiscussionPromptItem(**p) for p in data.get("prompts", [])],
    )


def generate_essay_prompt(
    slot: SessionSlot,
    pages: list[PageContent],
    scaffolding_level: str = "standard",
    standards_framework: str | None = None,
    content_type: str = "pdf",
) -> EssayPrompt:
    text, source_ref = _prof_text(pages, slot, content_type)
    sc = _SCAFFOLDING_INSTRUCTIONS.get(scaffolding_level, _SCAFFOLDING_INSTRUCTIONS["standard"])
    schema = '''{"title":"string","prompt":"string","context":"string","word_count_guidance":"string","rubric":[{"criterion":"string","weight":"string","excellent":"string","satisfactory":"string","needs_improvement":"string"}]}'''
    prompt = f"""You are an expert educator writing an essay prompt and grading rubric for a college professor.

SOURCE: {source_ref}
{sc}

SOURCE EXCERPT
{text or "(No extractable text.)"}

---

INSTRUCTIONS
1. Write ONE substantial essay prompt grounded STRICTLY in the excerpt. No outside facts.
2. The prompt should require analysis, argument, or synthesis — not just summary.
3. Include a context paragraph (2–3 sentences) giving students background for the essay.
4. Include realistic word count guidance (e.g. "1,200–1,500 words").
5. Write a 4–5 criterion rubric. Weights must sum to 100%. For each criterion include excellent, satisfactory, and needs_improvement descriptors.

Return ONLY valid JSON: {schema}"""
    data = _llm(prompt, max_tokens=3000)
    return EssayPrompt(
        session_number=slot.session_number, week_number=slot.week_number,
        title=data["title"], source_ref=source_ref,
        scaffolding_level=scaffolding_level, standards_framework=standards_framework,
        prompt=data["prompt"], context=data.get("context", ""),
        word_count_guidance=data.get("word_count_guidance", ""),
        rubric=[RubricCriterion(**c) for c in data.get("rubric", [])],
    )


def generate_question_bank(
    slot: SessionSlot,
    pages: list[PageContent],
    scaffolding_level: str = "standard",
    standards_framework: str | None = None,
    content_type: str = "pdf",
) -> QuestionBank:
    text, source_ref = _prof_text(pages, slot, content_type)
    sc = _SCAFFOLDING_INSTRUCTIONS.get(scaffolding_level, _SCAFFOLDING_INSTRUCTIONS["standard"])
    schema = '''{"title":"string","questions":[{"type":"multiple_choice|short_answer|essay","question":"string","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"string","page_ref":int_or_null}]}'''
    prompt = f"""You are an expert educator building an exam question bank for a college professor.

SOURCE: {source_ref}
{sc}

SOURCE EXCERPT
{text or "(No extractable text.)"}

---

INSTRUCTIONS
1. Create 10–14 questions grounded STRICTLY in the excerpt. No outside facts.
2. Include a mix: 5–6 multiple choice (4 options each, clear correct answer), 3–4 short answer, 2–3 essay questions.
3. Multiple choice: options array must have exactly 4 items ("A. ...", "B. ...", etc.), answer is the letter only (e.g. "B").
4. Short answer: answer is a model 2–4 sentence response. options = [].
5. Essay: answer is a brief marking guide (what a strong response must cover). options = [].
6. Set page_ref to the source page for each question.

Return ONLY valid JSON: {schema}"""
    data = _llm(prompt, max_tokens=4000)
    return QuestionBank(
        session_number=slot.session_number, week_number=slot.week_number,
        title=data["title"], source_ref=source_ref,
        scaffolding_level=scaffolding_level, standards_framework=standards_framework,
        questions=[QuestionBankItem(**q) for q in data.get("questions", [])],
    )
