from fastapi import APIRouter, HTTPException
from app.schemas import CostEstimateRequest, CostEstimateResponse
from app.services.lesson_generator import estimate_cost
from app.storage import get_session

router = APIRouter()


@router.post("/cost-estimate", response_model=CostEstimateResponse)
async def cost_estimate(req: CostEstimateRequest):
    session = get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    data = estimate_cost(req.total_sessions)
    return CostEstimateResponse(**data)
