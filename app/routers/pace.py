from datetime import date, timedelta
from fastapi import APIRouter, HTTPException
from app.schemas import PaceRequest, PaceResponse, Schedule
from app.services.pacing_engine import build_schedule
from app.storage import get_session, update_session

router = APIRouter()

_DAY_OFFSETS = {
    1: [0], 2: [0, 3], 3: [0, 2, 4],
    4: [0, 1, 2, 4], 5: [0, 1, 2, 3, 4],
    6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6],
}


def _assign_dates(schedule: Schedule, term_start_date: str, holidays: list[str]) -> Schedule:
    try:
        start = date.fromisoformat(term_start_date)
    except ValueError:
        return schedule

    holiday_set = set()
    for h in holidays:
        try:
            holiday_set.add(date.fromisoformat(h))
        except ValueError:
            pass

    offsets = _DAY_OFFSETS.get(schedule.sessions_per_week, _DAY_OFFSETS[5])

    for slot in schedule.sessions:
        day_idx = slot.day_number - 1
        day_offset = offsets[day_idx] if day_idx < len(offsets) else day_idx
        candidate = start + timedelta(weeks=slot.week_number - 1, days=day_offset)
        while candidate in holiday_set:
            candidate += timedelta(days=1)
        slot.session_date = candidate.isoformat()

    schedule.term_start_date = term_start_date
    schedule.holidays = holidays
    return schedule


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

    if req.term_start_date:
        schedule = _assign_dates(schedule, req.term_start_date, req.holidays)

    session.schedule = schedule
    session.completed_lessons = {}
    update_session(session)

    return PaceResponse(
        session_id=req.session_id,
        filename=session.filename,
        schedule=schedule,
    )
