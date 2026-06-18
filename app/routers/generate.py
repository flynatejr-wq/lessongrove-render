import asyncio
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.schemas import GenerateRequest, GenerateProgressEvent
from app.services.lesson_generator import generate_lesson
from app.storage import get_session, update_session
from app.config import settings

router = APIRouter()


def _build_prior_context(completed: dict, slots_so_far: list) -> str:
    if not completed:
        return ""
    lines = []
    for slot in slots_so_far:
        lesson = completed.get(slot.session_number)
        if lesson:
            topics = ", ".join(lesson.source_sections) or lesson.title
            lines.append(f"  Session {slot.session_number} (pp. {slot.start_page}–{slot.end_page}): {topics}")
    return "\n".join(lines)


async def _stream_lessons(session_id: str, scaffolding: str, standards: str | None, resume: bool):
    session = get_session(session_id)
    if not session:
        event = GenerateProgressEvent(session_number=0, total_sessions=0, status="error",
                                      error="Session not found. Upload a PDF first.")
        yield f"data: {event.model_dump_json()}\n\n"
        return

    if not session.schedule:
        event = GenerateProgressEvent(session_number=0, total_sessions=0, status="error",
                                      error="No schedule found. Build a schedule first.")
        yield f"data: {event.model_dump_json()}\n\n"
        return

    slots = session.schedule.sessions
    total = len(slots)
    completed = dict(session.completed_lessons)  # copy

    for i, slot in enumerate(slots):
        # Resumable: skip already-done sessions
        if resume and slot.session_number in completed:
            event = GenerateProgressEvent(session_number=slot.session_number,
                                          total_sessions=total, status="skipped",
                                          lesson=completed[slot.session_number])
            yield f"data: {event.model_dump_json()}\n\n"
            continue

        start_event = GenerateProgressEvent(session_number=slot.session_number,
                                            total_sessions=total, status="generating")
        yield f"data: {start_event.model_dump_json()}\n\n"

        prior_context = _build_prior_context(completed, slots[:i])

        try:
            lesson = await asyncio.to_thread(
                generate_lesson, slot, session.pages, total,
                scaffolding, standards, prior_context
            )
            completed[slot.session_number] = lesson
            # Persist after each lesson so resumption works
            session.completed_lessons = completed
            session.scaffolding_level = scaffolding
            session.standards_framework = standards
            update_session(session)

            done_event = GenerateProgressEvent(session_number=slot.session_number,
                                               total_sessions=total, status="done",
                                               lesson=lesson)
            yield f"data: {done_event.model_dump_json()}\n\n"
        except Exception as exc:
            err_event = GenerateProgressEvent(session_number=slot.session_number,
                                              total_sessions=total, status="error",
                                              error=str(exc))
            yield f"data: {err_event.model_dump_json()}\n\n"


@router.post("/generate")
async def generate_lessons(req: GenerateRequest):
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500,
                            detail="ANTHROPIC_API_KEY is not configured on the server. Add it to Render → Environment and redeploy.")
    session = get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if not session.schedule:
        raise HTTPException(status_code=400, detail="No schedule found. Build a schedule first.")

    return StreamingResponse(
        _stream_lessons(req.session_id, req.scaffolding, req.standards, req.resume),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
