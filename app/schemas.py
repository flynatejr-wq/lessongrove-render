from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel


class Block(BaseModel):
    text: str
    font_size: float | None = None
    is_bold: bool = False


class PageContent(BaseModel):
    page_num: int   # 1-based
    text: str
    blocks: list[Block] = []


class Section(BaseModel):
    title: str
    start_page: int
    end_page: int | None = None


class Chapter(BaseModel):
    title: str
    chapter_num: int | None = None
    start_page: int
    end_page: int | None = None
    sections: list[Section] = []


class StructureMap(BaseModel):
    detection_method: str   # "toc" | "font_heuristic" | "regex" | "llm_fallback" | "flat"
    total_pages: int
    chapters: list[Chapter]
    warnings: list[str] = []


class SessionData(BaseModel):
    session_id: str
    filename: str
    pages: list[PageContent]
    content_type: str = "pdf"   # "pdf" | "text" | "youtube" | "url" | "docx" | "image"
    structure: StructureMap | None = None
    schedule: "Schedule | None" = None
    completed_lessons: dict[int, "LessonPlan"] = {}  # session_number -> lesson
    scaffolding_level: str = "standard"
    standards_framework: str | None = None
    created_at: datetime


class UploadResponse(BaseModel):
    session_id: str
    filename: str
    total_pages: int
    structure: StructureMap
    message: str


class StructureResponse(BaseModel):
    session_id: str
    filename: str
    structure: StructureMap


class UpdateStructureRequest(BaseModel):
    session_id: str
    chapters: list[Chapter]


# ── Phase 2: Pacing ──────────────────────────────────────────────────────────

class ScheduleUnit(BaseModel):
    title: str
    start_page: int
    end_page: int
    source: str  # "chapter" | "section"


class SessionSlot(BaseModel):
    session_number: int
    week_number: int
    day_number: int       # 1-based within the week
    units: list[ScheduleUnit]
    start_page: int
    end_page: int
    page_count: int
    session_date: str | None = None  # ISO date string e.g. "2025-09-01"


class Schedule(BaseModel):
    total_weeks: int
    sessions_per_week: int
    total_sessions: int
    target_pages_per_session: int
    sessions: list[SessionSlot]
    term_start_date: str | None = None
    holidays: list[str] = []


class PaceRequest(BaseModel):
    session_id: str
    total_weeks: int
    sessions_per_week: int
    term_start_date: str | None = None   # ISO date "YYYY-MM-DD"
    holidays: list[str] = []              # ISO dates to skip


class PaceResponse(BaseModel):
    session_id: str
    filename: str
    schedule: Schedule


# ── Phase 3: Lesson Plans ─────────────────────────────────────────────────────

class LearningObjective(BaseModel):
    text: str
    page_ref: int | None = None


class KeyConcept(BaseModel):
    term: str
    definition: str
    page_ref: int | None = None


class Activity(BaseModel):
    title: str
    description: str
    duration_minutes: int | None = None
    page_ref: int | None = None


class AssessmentQuestion(BaseModel):
    question: str
    type: str  # "discussion" | "written" | "short_answer"
    page_ref: int | None = None


class LessonFlag(BaseModel):
    reason: str
    flagged_at: str  # ISO datetime string


class LessonPlan(BaseModel):
    schema_version: str = "1.1"
    session_number: int
    week_number: int
    day_number: int
    title: str
    page_range: str
    source_sections: list[str]
    scaffolding_level: str = "standard"   # "light" | "standard" | "heavy"
    standards_framework: str | None = None
    learning_objectives: list[LearningObjective]
    key_concepts: list[KeyConcept]
    activities: list[Activity]
    assessment_questions: list[AssessmentQuestion]
    homework: str | None = None
    flags: list[LessonFlag] = []


class GenerateRequest(BaseModel):
    session_id: str
    scaffolding: str = "standard"         # "light" | "standard" | "heavy"
    standards: str | None = None          # e.g. "US Common Core", "UK National Curriculum"
    resume: bool = False                  # skip already-completed sessions


class GenerateProgressEvent(BaseModel):
    session_number: int
    total_sessions: int
    status: str          # "generating" | "done" | "error" | "skipped"
    lesson: LessonPlan | None = None
    error: str | None = None


# ── Partial regeneration ──────────────────────────────────────────────────────

class RegenerateSectionRequest(BaseModel):
    session_id: str
    session_number: int
    section: str          # "learning_objectives" | "key_concepts" | "activities" | "assessment_questions" | "homework"
    scaffolding: str = "standard"
    standards: str | None = None


class RegenerateSectionResponse(BaseModel):
    session_number: int
    section: str
    data: list | str | None   # new content for that section


# ── Flag lesson ───────────────────────────────────────────────────────────────

class FlagLessonRequest(BaseModel):
    session_id: str
    session_number: int
    reason: str


class FlagLessonResponse(BaseModel):
    status: str
    session_number: int
    flags: list[LessonFlag]


# ── Assignment ───────────────────────────────────────────────────────────────

class AssignmentTask(BaseModel):
    number: int
    prompt: str
    page_ref: int | None = None


class Assignment(BaseModel):
    schema_version: str = "1.2"
    session_number: int = 1
    week_number: int = 1
    day_number: int = 1
    title: str
    assignment_type: str   # "worksheet" | "problem_set" | "discussion_prompt" | "project_brief"
    source_ref: str        # page range, timestamp range, or "Full document"
    source_sections: list[str]
    scaffolding_level: str
    standards_framework: str | None = None
    overview: str
    tasks: list[AssignmentTask]
    flags: list[LessonFlag] = []


# ── Ingest (non-PDF sources) ──────────────────────────────────────────────────

class IngestTextRequest(BaseModel):
    text: str
    title: str = "Pasted text"


class IngestUrlRequest(BaseModel):
    url: str


class IngestResponse(BaseModel):
    session_id: str
    filename: str
    total_pages: int       # chunk count for non-PDF
    content_type: str
    message: str


# ── Professor output types ───────────────────────────────────────────────────

class LecturePoint(BaseModel):
    text: str
    page_ref: int | None = None


class LectureSection(BaseModel):
    heading: str
    duration_minutes: int | None = None
    points: list[LecturePoint]


class LectureOutline(BaseModel):
    schema_version: str = "1.0"
    session_number: int = 1
    week_number: int = 1
    title: str
    source_ref: str
    scaffolding_level: str = "standard"
    standards_framework: str | None = None
    overview: str
    sections: list[LectureSection]


class DiscussionPromptItem(BaseModel):
    prompt: str
    follow_ups: list[str] = []
    page_ref: int | None = None


class DiscussionPrompts(BaseModel):
    schema_version: str = "1.0"
    session_number: int = 1
    week_number: int = 1
    title: str
    source_ref: str
    scaffolding_level: str = "standard"
    standards_framework: str | None = None
    overview: str
    prompts: list[DiscussionPromptItem]


class RubricCriterion(BaseModel):
    criterion: str
    weight: str
    excellent: str
    satisfactory: str
    needs_improvement: str


class EssayPrompt(BaseModel):
    schema_version: str = "1.0"
    session_number: int = 1
    week_number: int = 1
    title: str
    source_ref: str
    scaffolding_level: str = "standard"
    standards_framework: str | None = None
    prompt: str
    context: str
    word_count_guidance: str
    rubric: list[RubricCriterion]


class QuestionBankItem(BaseModel):
    type: str          # "multiple_choice" | "short_answer" | "essay"
    question: str
    options: list[str] = []   # A/B/C/D for MC
    answer: str
    page_ref: int | None = None


class QuestionBank(BaseModel):
    schema_version: str = "1.0"
    session_number: int = 1
    week_number: int = 1
    title: str
    source_ref: str
    scaffolding_level: str = "standard"
    standards_framework: str | None = None
    questions: list[QuestionBankItem]


# ── Cost estimation ───────────────────────────────────────────────────────────

class CostEstimateRequest(BaseModel):
    session_id: str
    total_sessions: int


class CostEstimateResponse(BaseModel):
    total_sessions: int
    estimated_input_tokens: int
    estimated_output_tokens: int
    estimated_cost_usd: float
    model: str
    note: str
