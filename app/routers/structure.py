from fastapi import APIRouter, HTTPException
from app.schemas import StructureResponse
from app.storage import get_session

router = APIRouter()


@router.get("/structure/{session_id}", response_model=StructureResponse)
async def get_structure(session_id: str):
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found. Upload a PDF first.")
    if not session.structure:
        raise HTTPException(status_code=400, detail="Structure not yet available for this session.")

    return StructureResponse(
        session_id=session_id,
        filename=session.filename,
        structure=session.structure,
    )
