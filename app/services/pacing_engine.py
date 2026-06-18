"""
Deterministic pacing algorithm.

Flattens the structure map into ordered units (sections preferred over chapters),
then greedy-assigns them to session slots respecting natural boundaries.
Large single units (> 2x target) are split across sessions at page level.
"""
from __future__ import annotations
from app.schemas import Chapter, Schedule, ScheduleUnit, SessionSlot, StructureMap


def build_schedule(
    structure: StructureMap,
    total_weeks: int,
    sessions_per_week: int,
) -> Schedule:
    total_sessions = total_weeks * sessions_per_week
    total_pages = structure.total_pages
    target = total_pages / total_sessions if total_sessions else total_pages

    units = _flatten_to_units(structure)
    groups = _group_into_sessions(units, total_sessions, target)

    slots: list[SessionSlot] = []
    for i, group in enumerate(groups):
        session_num = i + 1
        week_num = (i // sessions_per_week) + 1
        day_num = (i % sessions_per_week) + 1
        start_page = group[0].start_page if group else 0
        end_page = group[-1].end_page if group else 0
        page_count = max(0, end_page - start_page + 1) if group else 0
        slots.append(SessionSlot(
            session_number=session_num,
            week_number=week_num,
            day_number=day_num,
            units=group,
            start_page=start_page,
            end_page=end_page,
            page_count=page_count,
        ))

    return Schedule(
        total_weeks=total_weeks,
        sessions_per_week=sessions_per_week,
        total_sessions=total_sessions,
        target_pages_per_session=max(1, round(target)),
        sessions=slots,
    )


def _flatten_to_units(structure: StructureMap) -> list[ScheduleUnit]:
    """Convert StructureMap to an ordered flat list of ScheduleUnit.
    Uses sections when present, otherwise the chapter itself."""
    units: list[ScheduleUnit] = []
    for ch in structure.chapters:
        ch_end = ch.end_page or structure.total_pages
        if ch.sections:
            for j, sec in enumerate(ch.sections):
                sec_end = (
                    ch.sections[j + 1].start_page - 1
                    if j + 1 < len(ch.sections)
                    else ch_end
                )
                units.append(ScheduleUnit(
                    title=f"{ch.title} — {sec.title}",
                    start_page=sec.start_page,
                    end_page=max(sec.start_page, sec_end),
                    source="section",
                ))
        else:
            units.append(ScheduleUnit(
                title=ch.title,
                start_page=ch.start_page,
                end_page=ch_end,
                source="chapter",
            ))
    return units


def _group_into_sessions(
    units: list[ScheduleUnit],
    total_sessions: int,
    target: float,
) -> list[list[ScheduleUnit]]:
    """Greedily assign units to session buckets."""
    if not units or total_sessions == 0:
        return [[] for _ in range(max(1, total_sessions))]

    groups: list[list[ScheduleUnit]] = []
    bucket: list[ScheduleUnit] = []
    bucket_pages = 0

    def flush() -> None:
        groups.append(bucket[:])
        bucket.clear()

    for unit in units:
        unit_pages = max(1, unit.end_page - unit.start_page + 1)
        sessions_left = total_sessions - len(groups)

        # Split oversized units across multiple sessions
        if unit_pages > target * 2 and sessions_left > 1:
            if bucket:
                flush()
                bucket_pages = 0

            seg_start = unit.start_page
            while seg_start <= unit.end_page:
                remaining_sessions = total_sessions - len(groups)
                if remaining_sessions <= 1:
                    # Last session — put everything left into bucket
                    label = unit.title + (" (cont.)" if seg_start > unit.start_page else "")
                    bucket.append(ScheduleUnit(
                        title=label,
                        start_page=seg_start,
                        end_page=unit.end_page,
                        source=unit.source,
                    ))
                    bucket_pages += unit.end_page - seg_start + 1
                    break
                seg_end = min(seg_start + max(1, int(target)) - 1, unit.end_page)
                label = unit.title + (" (cont.)" if seg_start > unit.start_page else "")
                groups.append([ScheduleUnit(
                    title=label,
                    start_page=seg_start,
                    end_page=seg_end,
                    source=unit.source,
                )])
                seg_start = seg_end + 1
        else:
            bucket.append(unit)
            bucket_pages += unit_pages

            # Flush when target reached, unless this is the last session slot
            if bucket_pages >= target and len(groups) < total_sessions - 1:
                flush()
                bucket_pages = 0

    # Remaining content goes into the last session
    if bucket:
        groups.append(bucket[:])

    # Pad with empty sessions if content ran out early
    while len(groups) < total_sessions:
        groups.append([])

    return groups[:total_sessions]
