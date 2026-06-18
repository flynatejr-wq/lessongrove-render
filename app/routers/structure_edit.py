from fastapi import APIRouter, HTTPException
from app.schemas import UpdateStructureRequest
from app.storage import get_session, update_session

router = APIRouter()


@router.patch("/structure")
async def update_structure(req: UpdateStructureRequest):
    session = get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if not session.structure:
        raise HTTPException(status_code=400, detail="No structure found for this session.")
    if not req.chapters:
        raise HTTPException(status_code=400, detail="chapters list cannot be empty.")

    session.structure.chapters = req.chapters
    session.schedule = None          # invalidate old schedule
    session.completed_lessons = {}   # invalidate old lessons
    update_session(session)

    return {"status": "ok", "chapter_count": len(req.chapters)}
