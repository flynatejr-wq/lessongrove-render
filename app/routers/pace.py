from fastapi import APIRouter, HTTPException
from app.schemas import PaceRequest, PaceResponse
from app.services.pacing_engine import build_schedule
from app.storage import get_session, update_session

router = APIRouter()


@router.post("/pace", response_model=PaceResponse)
async def pace_curriculum(req: PaceRequest):
    session = get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found. Upload a PDF first.")
    if not session.structure:
        raise HTTPException(status_code=400, detail="Structure not detected for this session.")
    if req.total_weeks < 1 or req.sessions_per_week < 1:
        raise HTTPException(status_code=422, detail="total_weeks and sessions_per_week must be at least 1.")
    if req.total_weeks > 52 or req.sessions_per_week > 7:
        raise HTTPException(status_code=422, detail="total_weeks max 52, sessions_per_week max 7.")

    schedule = build_schedule(
        structure=session.structure,
        total_weeks=req.total_weeks,
        sessions_per_week=req.sessions_per_week,
    )

    session.schedule = schedule
    update_session(session)

    return PaceResponse(
        session_id=req.session_id,
        filename=session.filename,
        schedule=schedule,
    )
