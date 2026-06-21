import os
import jwt
from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

_bearer = HTTPBearer(auto_error=False)
_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer),
) -> str:
    if not _JWT_SECRET:
        # JWT secret not configured — skip auth (dev mode)
        return "dev"
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    try:
        payload = jwt.decode(
            credentials.credentials,
            _JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload["sub"]  # Supabase user ID
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token.")
