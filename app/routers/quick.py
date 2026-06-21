import asyncio
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.schemas import SessionSlot, ScheduleUnit
from app.services.lesson_generator import (
    generate_lesson, generate_assignment,
    generate_lecture_outline, generate_discussion_prompts,
    generate_essay_prompt, generate_question_bank,
)
from app.storage import get_session
from app.config import settings
from app.auth import get_current_user

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

PROFESSOR_TYPES = {"lecture_outline", "discussion_prompts", "essay_prompt", "question_bank"}


class QuickLessonRequest(BaseModel):
    session_id: str
    start_page: int | None = None
    end_page: int | None = None
    title: str = "Quick Lesson"
    scaffolding: str = "standard"
    standards: str | None = None
    output_type: str = "lesson"
    assignment_type: str = "worksheet"


@router.post("/quick-lesson")
@limiter.limit("20/hour")
async def quick_lesson(request: Request, req: QuickLessonRequest, user_id: str = Depends(get_current_user)):
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500,
                            detail="ANTHROPIC_API_KEY is not configured on the server.")
    session = get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found. Upload your source first.")

    is_pdf = session.content_type == "pdf"
    total = len(session.pages)

    if is_pdf:
        start = req.start_page if req.start_page is not None else 1
        end   = req.end_page   if req.end_page   is not None else total
        if start < 1 or end > total or start > end:
            raise HTTPException(status_code=400,
                                detail=f"Page range must be between 1 and {total}, with start ≤ end.")
    else:
        start = 1
        end   = total

    slot = SessionSlot(
        session_number=1, week_number=1, day_number=1,
        units=[ScheduleUnit(title=req.title, start_page=start, end_page=end, source="chapter")],
        start_page=start, end_page=end,
        page_count=end - start + 1,
    )

    prof_kwargs = dict(
        slot=slot, pages=session.pages,
        scaffolding_level=req.scaffolding,
        standards_framework=req.standards,
        content_type=session.content_type,
    )

    try:
        if req.output_type == "lecture_outline":
            result = await asyncio.to_thread(generate_lecture_outline, **prof_kwargs)
        elif req.output_type == "discussion_prompts":
            result = await asyncio.to_thread(generate_discussion_prompts, **prof_kwargs)
        elif req.output_type == "essay_prompt":
            result = await asyncio.to_thread(generate_essay_prompt, **prof_kwargs)
        elif req.output_type == "question_bank":
            result = await asyncio.to_thread(generate_question_bank, **prof_kwargs)
        elif req.output_type == "assignment":
            result = await asyncio.to_thread(
                generate_assignment, slot, session.pages, req.scaffolding, req.standards,
                req.assignment_type, session.content_type,
            )
        else:
            result = await asyncio.to_thread(
                generate_lesson, slot, session.pages, 1, req.scaffolding, req.standards
            )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return result
