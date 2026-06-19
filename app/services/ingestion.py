"""
Non-PDF ingestion: text, YouTube, URL, Word doc, image.
All return list[PageContent] using chunk index as page_num.
"""
import base64
import io
import re
import textwrap
from app.schemas import PageContent

_CHUNK_CHARS = 3_000   # ~750 words per chunk


def _chunk_text(text: str, source_label: str = "") -> list[PageContent]:
    """Split a long text string into PageContent chunks."""
    paragraphs = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
    chunks: list[str] = []
    current = ""
    for para in paragraphs:
        if len(current) + len(para) > _CHUNK_CHARS and current:
            chunks.append(current.strip())
            current = para
        else:
            current = (current + "\n\n" + para) if current else para
    if current.strip():
        chunks.append(current.strip())
    if not chunks:
        chunks = [text[:_CHUNK_CHARS]] if text.strip() else ["(No content extracted.)"]
    return [PageContent(page_num=i + 1, text=chunk) for i, chunk in enumerate(chunks)]


def ingest_text(text: str) -> list[PageContent]:
    return _chunk_text(text)


def ingest_docx(file_bytes: bytes) -> list[PageContent]:
    import docx  # python-docx
    doc = docx.Document(io.BytesIO(file_bytes))
    lines = []
    for para in doc.paragraphs:
        t = para.text.strip()
        if not t:
            continue
        # Mark headings with extra newline so chunker treats them as section breaks
        if para.style.name.startswith("Heading"):
            lines.append("\n" + t)
        else:
            lines.append(t)
    full_text = "\n\n".join(lines)
    return _chunk_text(full_text)


def ingest_youtube(url: str) -> list[PageContent]:
    # youtube-transcript-api 1.x: entries are objects with .text/.start/.duration
    # Fall back to dict-key access for older installs
    from youtube_transcript_api import YouTubeTranscriptApi

    video_id = _extract_youtube_id(url)
    if not video_id:
        raise ValueError(f"Could not extract a YouTube video ID from: {url}")

    try:
        raw = YouTubeTranscriptApi.get_transcript(video_id)
    except Exception as e:
        raise ValueError(f"No transcript available for this video: {e}")

    def _get(entry, key: str):
        try:
            return getattr(entry, key)
        except AttributeError:
            return entry[key]

    # Group entries into ~2-minute chunks
    chunks: list[PageContent] = []
    chunk_lines: list[str] = []
    chunk_start = 0.0
    chunk_duration = 120.0  # seconds

    def _fmt_time(s: float) -> str:
        m, sec = divmod(int(s), 60)
        h, m = divmod(m, 60)
        return f"{h}:{m:02d}:{sec:02d}" if h else f"{m}:{sec:02d}"

    for entry in raw:
        start = _get(entry, "start")
        text  = _get(entry, "text")
        if start - chunk_start >= chunk_duration and chunk_lines:
            chunks.append(PageContent(
                page_num=len(chunks) + 1,
                text=f"[{_fmt_time(chunk_start)}–{_fmt_time(start)}]\n" + " ".join(chunk_lines),
            ))
            chunk_lines = []
            chunk_start = start
        chunk_lines.append(text)

    if chunk_lines:
        chunks.append(PageContent(
            page_num=len(chunks) + 1,
            text=f"[{_fmt_time(chunk_start)}–end]\n" + " ".join(chunk_lines),
        ))

    return chunks or [PageContent(page_num=1, text="(Transcript was empty.)")]


def ingest_url(url: str) -> list[PageContent]:
    import trafilatura
    downloaded = trafilatura.fetch_url(url)
    if not downloaded:
        raise ValueError(f"Could not fetch content from: {url}")
    text = trafilatura.extract(downloaded, include_comments=False, include_tables=True)
    if not text or not text.strip():
        raise ValueError(f"No readable content found at: {url}")
    return _chunk_text(text)


def ingest_image(image_bytes: bytes, media_type: str, api_key: str) -> list[PageContent]:
    """Pass the image to Claude vision to extract and describe content."""
    import anthropic
    b64 = base64.standard_b64encode(image_bytes).decode()
    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {"type": "base64", "media_type": media_type, "data": b64},
                },
                {
                    "type": "text",
                    "text": (
                        "You are helping a teacher extract teaching content from an image. "
                        "Describe what you see in full detail. If there is text (handwritten or printed), "
                        "transcribe it exactly. If there are diagrams, equations, or tables, describe them "
                        "in structured prose. Preserve all information that a teacher could use to build a lesson plan."
                    ),
                },
            ],
        }],
    )
    extracted = message.content[0].text.strip()
    return [PageContent(page_num=1, text=extracted)]


def _extract_youtube_id(url: str) -> str | None:
    patterns = [
        r"(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([A-Za-z0-9_-]{11})",
    ]
    for pat in patterns:
        m = re.search(pat, url)
        if m:
            return m.group(1)
    return None
