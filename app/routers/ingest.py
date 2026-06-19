"""
Ingest non-PDF sources: text paste, YouTube, web URL, Word doc (.docx), image.
Each endpoint creates a session identical to /upload (same storage shape) so
the rest of the pipeline (quick-lesson, generate) works unchanged.
"""
import uuid
from datetime import datetime

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.config import settings
from app.schemas import (
    IngestResponse,
    IngestTextRequest,
    IngestUrlRequest,
    SessionData,
)
from app.services.ingestion import (
    ingest_docx,
    ingest_image,
    ingest_text,
    ingest_url,
    ingest_youtube,
)
from app.storage import save_session

router = APIRouter(prefix="/ingest", tags=["ingest"])

_ALLOWED_IMAGE_TYPES = {
    "image/jpeg": "image/jpeg",
    "image/jpg":  "image/jpeg",
    "image/png":  "image/png",
    "image/gif":  "image/gif",
    "image/webp": "image/webp",
}


def _make_session(pages, content_type: str, title: str) -> SessionData:
    session = SessionData(
        session_id=str(uuid.uuid4()),
        filename=title,
        pages=pages,
        content_type=content_type,
        created_at=datetime.utcnow(),
    )
    save_session(session)
    return session


def _response(session: SessionData, message: str) -> IngestResponse:
    return IngestResponse(
        session_id=session.session_id,
        filename=session.filename,
        total_pages=len(session.pages),
        content_type=session.content_type,
        message=message,
    )


@router.post("/text", response_model=IngestResponse)
async def ingest_text_endpoint(req: IngestTextRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")
    try:
        pages = ingest_text(req.text)
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))
    session = _make_session(pages, "text", req.title or "Pasted text")
    return _response(session, f"Ingested {len(pages)} chunk(s) from pasted text.")


@router.post("/youtube", response_model=IngestResponse)
async def ingest_youtube_endpoint(req: IngestUrlRequest):
    try:
        pages = ingest_youtube(req.url)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"YouTube ingestion failed: {e}")
    title = f"YouTube: {req.url.split('v=')[-1][:20] if 'v=' in req.url else req.url[-30:]}"
    session = _make_session(pages, "youtube", title)
    return _response(session, f"Extracted transcript: {len(pages)} segment(s).")


@router.post("/url", response_model=IngestResponse)
async def ingest_url_endpoint(req: IngestUrlRequest):
    try:
        pages = ingest_url(req.url)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"URL ingestion failed: {e}")
    # Use domain as title
    from urllib.parse import urlparse
    domain = urlparse(req.url).netloc or req.url[:40]
    session = _make_session(pages, "url", domain)
    return _response(session, f"Extracted {len(pages)} chunk(s) from {domain}.")


@router.post("/docx", response_model=IngestResponse)
async def ingest_docx_endpoint(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="File must be a .docx Word document.")
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    try:
        pages = ingest_docx(file_bytes)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse Word document: {e}")
    session = _make_session(pages, "docx", file.filename)
    return _response(session, f"Extracted {len(pages)} chunk(s) from {file.filename}.")


@router.post("/image", response_model=IngestResponse)
async def ingest_image_endpoint(file: UploadFile = File(...)):
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured.")
    content_type = file.content_type or ""
    media_type = _ALLOWED_IMAGE_TYPES.get(content_type.lower())
    if not media_type:
        raise HTTPException(status_code=400, detail=f"Unsupported image type: {content_type}. Use JPEG, PNG, GIF, or WebP.")
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    try:
        pages = ingest_image(file_bytes, media_type, settings.anthropic_api_key)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image extraction failed: {e}")
    session = _make_session(pages, "image", file.filename or "image")
    return _response(session, "Image content extracted via Claude vision.")
