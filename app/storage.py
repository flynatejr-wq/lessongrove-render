import threading
from datetime import datetime, timedelta
from app.schemas import SessionData

_store: dict[str, SessionData] = {}
_lock = threading.Lock()
SESSION_TTL_HOURS = 4


def save_session(session: SessionData) -> None:
    with _lock:
        _store[session.session_id] = session


def get_session(session_id: str) -> SessionData | None:
    with _lock:
        return _store.get(session_id)


def update_session(session: SessionData) -> None:
    with _lock:
        _store[session.session_id] = session


def purge_old_sessions() -> int:
    cutoff = datetime.utcnow() - timedelta(hours=SESSION_TTL_HOURS)
    with _lock:
        old = [k for k, v in _store.items() if v.created_at < cutoff]
        for k in old:
            del _store[k]
    return len(old)
