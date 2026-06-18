import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.schemas import SessionSlot, ScheduleUnit, LessonPlan
from app.services.lesson_generator import generate_lesson
from app.storage import get_session
from app.config import settings

router = APIRouter()


class QuickLessonRequest(BaseModel):
    session_id: str
    start_page: int
    end_page: int
    title: str = "Quick Lesson"


@router.post("/quick-lesson", response_model=LessonPlan)
async def quick_lesson(req: QuickLessonRequest):
    if not settings.anthropic_api_key:
        raise HTTPException(
            status_code=500,
            detail="ANTHROPIC_API_KEY is not configured on the server. Add it to Railway → Variables and redeploy."
        )
    session = get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found. Upload a PDF first.")

    total = len(session.pages)
    if req.start_page < 1 or req.end_page > total or req.start_page > req.end_page:
        raise HTTPException(
            status_code=400,
            detail=f"Page range must be between 1 and {total}, with start ≤ end.",
        )

    slot = SessionSlot(
        session_number=1,
        week_number=1,
        day_number=1,
        units=[
            ScheduleUnit(
                title=req.title,
                start_page=req.start_page,
                end_page=req.end_page,
                source="chapter",
            )
        ],
        start_page=req.start_page,
        end_page=req.end_page,
        page_count=req.end_page - req.start_page + 1,
    )

    lesson = await asyncio.to_thread(generate_lesson, slot, session.pages, 1)
    return lesson
