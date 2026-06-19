import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.schemas import SessionSlot, ScheduleUnit, LessonPlan, Assignment
from app.services.lesson_generator import generate_lesson, generate_assignment
from app.storage import get_session
from app.config import settings

router = APIRouter()


class QuickLessonRequest(BaseModel):
    session_id: str
    start_page: int | None = None   # None = use all content (non-PDF sources)
    end_page: int | None = None
    title: str = "Quick Lesson"
    scaffolding: str = "standard"
    standards: str | None = None
    output_type: str = "lesson"             # "lesson" | "assignment"
    assignment_type: str = "worksheet"      # "worksheet"|"problem_set"|"discussion_prompt"|"project_brief"


@router.post("/quick-lesson")
async def quick_lesson(req: QuickLessonRequest):
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
        # Non-PDF: use all chunks
        start = 1
        end   = total

    slot = SessionSlot(
        session_number=1, week_number=1, day_number=1,
        units=[ScheduleUnit(title=req.title, start_page=start, end_page=end, source="chapter")],
        start_page=start, end_page=end,
        page_count=end - start + 1,
    )

    try:
        if req.output_type == "assignment":
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
