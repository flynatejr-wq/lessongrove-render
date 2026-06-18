"""
Structure detection cascade:
  Tier 1  — PDF native TOC (fitz.get_toc) — reliable when present
  Tier 1.5 — Textual TOC parser — for books with "CHAPTER N / Title ... page" tables of contents
  Tier 2  — Font-size heuristics (large/bold spans as headings)
  Tier 3  — Regex patterns (Chapter N, CHAPTER N, Part N, numbered headings)
  Tier 4  — LLM fallback (claude-sonnet-4-6 on first N pages)
  Fallback — flat single-chapter if nothing works (warns user)
"""
from __future__ import annotations
import json
import re
import statistics
from app.schemas import Block, Chapter, PageContent, Section, StructureMap
from app.services.pdf_extractor import get_native_toc
from app.config import settings


# ── Tier 1: Native TOC ──────────────────────────────────────────────────────

def _toc_to_structure(toc: list[list], total_pages: int) -> StructureMap | None:
    """Convert fitz TOC to StructureMap. Returns None if TOC is unusable."""
    # Filter to top-level entries with valid (positive) page numbers
    chapters = [e for e in toc if e[0] == 1 and e[2] > 0]
    if len(chapters) < 2:
        return None

    result: list[Chapter] = []
    for i, entry in enumerate(chapters):
        start = entry[2]
        end = chapters[i + 1][2] - 1 if i + 1 < len(chapters) else total_pages
        subs = [e for e in toc if e[0] == 2 and start <= e[2] <= end]
        sections = [Section(title=s[1], start_page=s[2]) for s in subs]
        result.append(Chapter(
            title=entry[1],
            start_page=start,
            end_page=end,
            sections=sections,
        ))

    return StructureMap(
        detection_method="toc",
        total_pages=total_pages,
        chapters=result,
    )


# ── Tier 1.5: Textual TOC parser ─────────────────────────────────────────────
#
# Many academic textbooks embed a "Table of Contents" or "Brief Contents" page
# in the front matter with "CHAPTER N / Title . . . . . page_num" entries.
# The body chapter pages carry a label (e.g. "chapter\n1\n") matching the
# textbook's internal page numbering.  We resolve the PDF-vs-textbook offset
# from one matched chapter page, then compute all other start pages from
# textbook_page + offset.

_CHAP_TOC_RE = re.compile(
    r'CHAPTER\s+(\d+)\s*[\r\n]\s*'   # "CHAPTER N" on its own line
    r'([A-Za-z][^\r\n]{4,80}?)'      # chapter title
    r'[\. ]{3,}'                      # dots / spaces fill
    r'(\d+)\s*(?:\r\n|\n|$)',         # page number at end of line
    re.MULTILINE,
)

_SEC_TOC_RE = re.compile(
    r'^([A-Z][A-Za-z0-9 ,\-\'/\(\):]{4,70}?)'  # section title starting with capital
    r'[\. ]{3,}'                                  # dots / spaces fill
    r'(\d+)\s*$',                                 # page number
    re.MULTILINE,
)

_SKIP_SEC_TITLES = {
    "chapter summary", "key terms", "review questions", "case projects",
    "foreword", "introduction", "glossary", "index", "appendix",
}

_BODY_CHAP_LABEL_RE = re.compile(r'chapter\s*\n\s*(\d+)\s*(?:\n|$)', re.IGNORECASE)


def _textual_toc_detect(pages: list[PageContent], total_pages: int) -> StructureMap | None:
    # ── Step 1: Collect text from TOC / Brief Contents pages ─────────────────
    toc_text = ""
    for page in pages[:30]:
        lower = page.text.lower()
        if "table of contents" in lower or "brief contents" in lower:
            toc_text += page.text + "\n"

    if not toc_text:
        return None

    # ── Step 2: Parse chapter entries ────────────────────────────────────────
    toc_entries: dict[int, tuple[str, int]] = {}  # num → (title, textbook_page)
    for m in _CHAP_TOC_RE.finditer(toc_text):
        num = int(m.group(1))
        title = m.group(2).strip().rstrip(".")
        tb_page = int(m.group(3))
        if num not in toc_entries:
            # Normalize common OCR spacing artifacts (e.g. "TCP /IP" → "TCP/IP")
            title = re.sub(r'\s+/', '/', title)
            title = re.sub(r'/\s+', '/', title)
            toc_entries[num] = (title, tb_page)

    if len(toc_entries) < 2:
        return None

    # ── Step 3: Find PDF offset from a body chapter label page ───────────────
    # Chapter title pages carry "chapter\n<textbook_page>\n" as a sidebar/label.
    textbook_pages = {tb_page for _, tb_page in toc_entries.values()}
    offset: int | None = None

    for page in pages[15:]:  # skip front matter
        for m in _BODY_CHAP_LABEL_RE.finditer(page.text):
            tb_num = int(m.group(1))
            if tb_num in textbook_pages:
                offset = page.page_num - tb_num
                break
        if offset is not None:
            break

    if offset is None:
        return None

    # ── Step 4: Parse sections from TOC ──────────────────────────────────────
    # Between each pair of CHAPTER headers, extract section-level lines.
    sorted_chaps = sorted(toc_entries.items())  # [(num, (title, tb_page)), ...]
    chapter_sections: dict[int, list[Section]] = {num: [] for num, _ in sorted_chaps}

    # Split toc_text into per-chapter chunks
    chap_positions = [(m.start(), int(m.group(1))) for m in _CHAP_TOC_RE.finditer(toc_text)]
    for i, (pos, num) in enumerate(chap_positions):
        end_pos = chap_positions[i + 1][0] if i + 1 < len(chap_positions) else len(toc_text)
        chunk = toc_text[pos:end_pos]
        # Skip the CHAPTER header line itself
        chunk_lines = chunk.split("\n", 2)
        section_text = chunk_lines[2] if len(chunk_lines) > 2 else ""

        for sm in _SEC_TOC_RE.finditer(section_text):
            sec_title = sm.group(1).strip()
            sec_tb_page = int(sm.group(2))
            if sec_title.lower() in _SKIP_SEC_TITLES:
                continue
            sec_pdf_page = max(1, sec_tb_page + offset)
            chapter_sections[num].append(Section(title=sec_title, start_page=sec_pdf_page))

    # ── Step 5: Build chapters ────────────────────────────────────────────────
    chapters: list[Chapter] = []
    for i, (num, (title, tb_page)) in enumerate(sorted_chaps):
        start_pdf = max(1, tb_page + offset)
        if i + 1 < len(sorted_chaps):
            next_tb = sorted_chaps[i + 1][1][1]
            end_pdf = max(start_pdf, next_tb + offset - 1)
        else:
            end_pdf = total_pages

        chapters.append(Chapter(
            title=f"Chapter {num}: {title}",
            chapter_num=num,
            start_page=start_pdf,
            end_page=end_pdf,
            sections=chapter_sections.get(num, []),
        ))

    return StructureMap(
        detection_method="textual_toc",
        total_pages=total_pages,
        chapters=chapters,
    )


# ── Tier 2: Font-size heuristics ─────────────────────────────────────────────

def _font_heuristic(pages: list[PageContent], total_pages: int) -> StructureMap | None:
    """Identify chapters by unusually large/bold font spans."""
    sizes = [
        b.font_size
        for p in pages
        for b in p.blocks
        if b.font_size and b.font_size > 0 and len(b.text) > 3
    ]
    if len(sizes) < 50:
        return None

    body_size = statistics.median(sizes)
    heading_threshold = body_size * 1.3

    chapter_pages: list[tuple[int, str]] = []

    for page in pages:
        # Collect all large-font blocks on this page and join them
        large_blocks = [
            b.text.strip()
            for b in page.blocks
            if b.font_size and b.font_size >= heading_threshold and b.text.strip()
        ]
        if not large_blocks:
            continue
        # Merge consecutive fragments into one title (handles split rendering)
        merged = " ".join(large_blocks)
        word_count = len(merged.split())
        if word_count <= 12:
            chapter_pages.append((page.page_num, merged))

    if len(chapter_pages) < 2:
        return None

    # Deduplicate consecutive entries with same text
    deduped = [chapter_pages[0]]
    for item in chapter_pages[1:]:
        if item[1] != deduped[-1][1]:
            deduped.append(item)

    if len(deduped) < 2:
        return None

    chapters: list[Chapter] = []
    for i, (start_page, title) in enumerate(deduped):
        end_page = deduped[i + 1][0] - 1 if i + 1 < len(deduped) else total_pages
        chapters.append(Chapter(title=title, start_page=start_page, end_page=end_page))

    return StructureMap(
        detection_method="font_heuristic",
        total_pages=total_pages,
        chapters=chapters,
    )


# ── Tier 3: Regex patterns ────────────────────────────────────────────────────

_CHAPTER_RE = re.compile(
    r"^(chapter|part|unit|module|section)\s+(\d+|[ivxlcdmIVXLCDM]+)[:\.\s]",
    re.IGNORECASE,
)
_NUMBERED_RE = re.compile(r"^\d+[\.\)]\s+[A-Z]")


def _regex_detect(pages: list[PageContent], total_pages: int) -> StructureMap | None:
    matches: list[tuple[int, str]] = []

    for page in pages:
        for block in page.blocks[:5]:
            text = block.text.strip()
            if _CHAPTER_RE.match(text) or _NUMBERED_RE.match(text):
                matches.append((page.page_num, text))
                break

    if len(matches) < 2:
        return None

    chapters: list[Chapter] = []
    for i, (start_page, title) in enumerate(matches):
        end_page = matches[i + 1][0] - 1 if i + 1 < len(matches) else total_pages
        chapters.append(Chapter(title=title, start_page=start_page, end_page=end_page))

    return StructureMap(
        detection_method="regex",
        total_pages=total_pages,
        chapters=chapters,
    )


# ── Tier 4: LLM fallback (Anthropic) ─────────────────────────────────────────

def _llm_fallback(pages: list[PageContent], total_pages: int) -> StructureMap:
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key or None)

        sample = pages[: settings.llm_structure_sample_pages]
        sample_text = "\n\n".join(
            f"[Page {p.page_num}]\n{p.text[:600]}" for p in sample
        )

        prompt = f"""You are analyzing the beginning of a textbook PDF to identify its chapter and section structure.

Here are the first {len(sample)} pages:

{sample_text}

Identify chapter and section boundaries. Return ONLY valid JSON in this exact format:
{{
  "chapters": [
    {{
      "title": "Chapter or section title",
      "start_page": 1,
      "sections": [
        {{"title": "Sub-section title", "start_page": 3}}
      ]
    }}
  ]
}}

Rules:
- Only include chapters/sections actually visible in the text above
- If no clear structure exists, return {{"chapters": []}}
- Do not invent or assume content beyond what you see"""

        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()

        if raw.startswith("```"):
            raw = re.sub(r"^```[a-z]*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw)

        data = json.loads(raw)
        chapters_data = data.get("chapters", [])

        if not chapters_data:
            return _flat_fallback(total_pages, warning="LLM could not detect structure")

        chapters: list[Chapter] = []
        for i, c in enumerate(chapters_data):
            start = c.get("start_page", 1)
            end = (
                chapters_data[i + 1].get("start_page", total_pages) - 1
                if i + 1 < len(chapters_data)
                else total_pages
            )
            sections = [
                Section(title=s["title"], start_page=s.get("start_page", start))
                for s in c.get("sections", [])
            ]
            chapters.append(Chapter(
                title=c["title"],
                start_page=start,
                end_page=end,
                sections=sections,
            ))

        return StructureMap(
            detection_method="llm_fallback",
            total_pages=total_pages,
            chapters=chapters,
            warnings=["Structure detected via LLM — verify chapter boundaries are accurate"],
        )

    except Exception as exc:
        return _flat_fallback(total_pages, warning=f"LLM fallback failed: {exc}")


def _flat_fallback(total_pages: int, warning: str = "") -> StructureMap:
    return StructureMap(
        detection_method="flat",
        total_pages=total_pages,
        chapters=[Chapter(title="Full Document", start_page=1, end_page=total_pages)],
        warnings=[warning] if warning else [
            "No chapter structure detected. The document will be treated as a single unit."
        ],
    )


# ── Public entry point ────────────────────────────────────────────────────────

def detect_structure(pages: list[PageContent], pdf_bytes: bytes) -> StructureMap:
    total_pages = len(pages)

    # Tier 1: Native TOC
    toc = get_native_toc(pdf_bytes)
    result = _toc_to_structure(toc, total_pages)
    if result:
        return result

    # Tier 1.5: Textual TOC parser
    result = _textual_toc_detect(pages, total_pages)
    if result:
        return result

    # Tier 2: Font heuristics
    result = _font_heuristic(pages, total_pages)
    if result:
        return result

    # Tier 3: Regex
    result = _regex_detect(pages, total_pages)
    if result:
        return result

    # Tier 4: LLM fallback (only if API key is configured)
    if settings.anthropic_api_key:
        return _llm_fallback(pages, total_pages)

    return _flat_fallback(total_pages, warning="No API key configured for LLM fallback")
