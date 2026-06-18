from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from app.schemas import FlagLessonRequest, FlagLessonResponse, LessonFlag
from app.storage import get_session, update_session

router = APIRouter()


@router.post("/flag-lesson", response_model=FlagLessonResponse)
async def flag_lesson(req: FlagLessonRequest):
    session = get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    lesson = session.completed_lessons.get(req.session_number)
    if not lesson:
        raise HTTPException(status_code=404, detail=f"Lesson {req.session_number} not found.")

    flag = LessonFlag(
        reason=req.reason,
        flagged_at=datetime.now(timezone.utc).isoformat(),
    )
    lesson.flags.append(flag)
    session.completed_lessons[req.session_number] = lesson
    update_session(session)

    return FlagLessonResponse(
        status="flagged",
        session_number=req.session_number,
        flags=lesson.flags,
    )
