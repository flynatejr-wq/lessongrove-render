import asyncio
import uuid
from datetime import datetime
from fastapi import APIRouter, File, HTTPException, UploadFile
from app.schemas import SessionData, UploadResponse
from app.services.pdf_extractor import extract_pages, is_scanned_pdf
from app.services.structure_detector import detect_structure
from app.storage import save_session

router = APIRouter()


@router.post("/upload", response_model=UploadResponse)
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    pdf_bytes = await file.read()

    pages = await asyncio.to_thread(extract_pages, pdf_bytes)

    if not pages:
        raise HTTPException(status_code=422, detail="Could not extract any pages from this PDF.")

    if is_scanned_pdf(pages):
        raise HTTPException(
            status_code=422,
            detail=(
                "This PDF appears to be a scanned image with no extractable text. "
                "Please use a PDF with selectable text, or run OCR on it first."
            ),
        )

    # Detect structure while we still have pdf_bytes (needed for Tier 1 native TOC)
    structure = await asyncio.to_thread(detect_structure, pages, pdf_bytes)

    session_id = str(uuid.uuid4())
    session = SessionData(
        session_id=session_id,
        filename=file.filename,
        pages=pages,
        structure=structure,
        created_at=datetime.utcnow(),
    )
    save_session(session)

    return UploadResponse(
        session_id=session_id,
        filename=file.filename,
        total_pages=len(pages),
        structure=structure,
        message=f"Detected {len(structure.chapters)} chapters via '{structure.detection_method}'.",
    )
