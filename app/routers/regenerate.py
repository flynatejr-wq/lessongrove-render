import asyncio
from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.schemas import RegenerateSectionRequest, RegenerateSectionResponse
from app.services.lesson_generator import regenerate_section
from app.storage import get_session, update_session
from app.config import settings
from app.auth import get_current_user

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

_VALID_SECTIONS = {"learning_objectives", "key_concepts", "activities", "assessment_questions", "homework"}


@router.post("/regenerate-section", response_model=RegenerateSectionResponse)
@limiter.limit("30/hour")
async def regen_section(request: Request, req: RegenerateSectionRequest, user_id: str = Depends(get_current_user)):
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured.")
    if req.section not in _VALID_SECTIONS:
        raise HTTPException(status_code=400, detail=f"section must be one of: {', '.join(_VALID_SECTIONS)}")

    session = get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    lesson = session.completed_lessons.get(req.session_number)
    if not lesson:
        raise HTTPException(status_code=404, detail=f"Lesson {req.session_number} not found. Generate it first.")

    # Find the session slot for this lesson number
    slot = None
    if session.schedule:
        for s in session.schedule.sessions:
            if s.session_number == req.session_number:
                slot = s
                break
    if not slot:
        raise HTTPException(status_code=404, detail="Session slot not found in schedule.")

    try:
        result = await asyncio.to_thread(
            regenerate_section, slot, session.pages, lesson.title,
            req.section, req.scaffolding, req.standards
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    # Patch the lesson in storage
    section_data = result.get(req.section)
    if req.section == "learning_objectives":
        lesson.learning_objectives = section_data
    elif req.section == "key_concepts":
        from app.schemas import KeyConcept
        lesson.key_concepts = [KeyConcept(**kc) for kc in section_data]
    elif req.section == "activities":
        from app.schemas import Activity
        lesson.activities = [Activity(**a) for a in section_data]
    elif req.section == "assessment_questions":
        from app.schemas import AssessmentQuestion
        lesson.assessment_questions = [AssessmentQuestion(**q) for q in section_data]
    elif req.section == "homework":
        lesson.homework = section_data

    session.completed_lessons[req.session_number] = lesson
    update_session(session)

    return RegenerateSectionResponse(
        session_number=req.session_number,
        section=req.section,
        data=section_data,
    )
