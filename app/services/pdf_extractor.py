import fitz  # PyMuPDF
from app.schemas import Block, PageContent


def extract_pages(pdf_bytes: bytes) -> list[PageContent]:
    """Extract text and font metadata page-by-page from PDF bytes."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages: list[PageContent] = []

    for page_index in range(len(doc)):
        page = doc[page_index]
        page_num = page_index + 1
        raw = page.get_text("dict")

        blocks: list[Block] = []
        text_parts: list[str] = []

        for block in raw.get("blocks", []):
            if block.get("type") != 0:   # skip image blocks
                continue
            for line in block.get("lines", []):
                line_parts: list[str] = []
                for span in line.get("spans", []):
                    text = span.get("text", "").strip()
                    if not text:
                        continue
                    flags = span.get("flags", 0)
                    is_bold = bool(flags & (1 << 4)) or "Bold" in span.get("font", "")
                    blocks.append(Block(
                        text=text,
                        font_size=round(span.get("size", 0), 1),
                        is_bold=is_bold,
                    ))
                    line_parts.append(text)
                if line_parts:
                    text_parts.append(" ".join(line_parts))

        pages.append(PageContent(
            page_num=page_num,
            text="\n".join(text_parts),
            blocks=blocks,
        ))

    doc.close()
    return pages


def get_native_toc(pdf_bytes: bytes) -> list[list]:
    """Return PDF's built-in table of contents as list of [level, title, page]."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    toc = doc.get_toc(simple=False)
    doc.close()
    return toc


def is_scanned_pdf(pages: list[PageContent]) -> bool:
    """Return True if most pages have no extractable text (likely scanned)."""
    if not pages:
        return False
    empty = sum(1 for p in pages if len(p.text.strip()) < 20)
    return empty / len(pages) > 0.7
