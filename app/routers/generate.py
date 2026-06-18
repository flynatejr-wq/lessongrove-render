import asyncio
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.schemas import GenerateRequest, GenerateProgressEvent
from app.services.lesson_generator import generate_lesson
from app.storage import get_session
from app.config import settings

router = APIRouter()


async def _stream_lessons(session_id: str):
    session = get_session(session_id)
    if not session:
        error_event = GenerateProgressEvent(
            session_number=0, total_sessions=0,
            status="error", error="Session not found. Upload a PDF first."
        )
        yield f"data: {error_event.model_dump_json()}\n\n"
        return

    if not session.schedule:
        error_event = GenerateProgressEvent(
            session_number=0, total_sessions=0,
            status="error", error="No schedule found. Build a schedule first."
        )
        yield f"data: {error_event.model_dump_json()}\n\n"
        return

    slots = session.schedule.sessions
    total = len(slots)

    for slot in slots:
        # Notify client we're starting this session
        start_event = GenerateProgressEvent(
            session_number=slot.session_number,
            total_sessions=total,
            status="generating",
        )
        yield f"data: {start_event.model_dump_json()}\n\n"

        try:
            lesson = await asyncio.to_thread(
                generate_lesson, slot, session.pages, total
            )
            done_event = GenerateProgressEvent(
                session_number=slot.session_number,
                total_sessions=total,
                status="done",
                lesson=lesson,
            )
            yield f"data: {done_event.model_dump_json()}\n\n"
        except Exception as exc:
            err_event = GenerateProgressEvent(
                session_number=slot.session_number,
                total_sessions=total,
                status="error",
                error=str(exc),
            )
            yield f"data: {err_event.model_dump_json()}\n\n"


@router.post("/generate")
async def generate_lessons(req: GenerateRequest):
    if not settings.anthropic_api_key:
        raise HTTPException(
            status_code=500,
            detail="ANTHROPIC_API_KEY is not configured on the server. Add it to Railway → Variables and redeploy."
        )
    session = get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if not session.schedule:
        raise HTTPException(status_code=400, detail="No schedule found. Build a schedule first.")

    return StreamingResponse(
        _stream_lessons(req.session_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering on Render
        },
    )
