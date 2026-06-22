import os
from functools import lru_cache

import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

_bearer = HTTPBearer(auto_error=False)
# Presence of this env var is the "auth enabled" switch. For legacy HS256 projects
# it's also the verification key; for modern asymmetric (ES256) projects the value
# only needs to be non-empty — tokens are verified against Supabase's public JWKS.
_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")


@lru_cache(maxsize=4)
def _jwks_client(jwks_url: str) -> PyJWKClient:
    return PyJWKClient(jwks_url)


def _verify(token: str) -> dict:
    alg = jwt.get_unverified_header(token).get("alg", "")

    if alg == "HS256":
        # Legacy shared-secret signing.
        if not _JWT_SECRET:
            raise HTTPException(status_code=401, detail="Invalid token.")
        return jwt.decode(
            token, _JWT_SECRET, algorithms=["HS256"], audience="authenticated"
        )

    # Asymmetric signing (ES256 / RS256): verify against Supabase's published keys.
    # Derive the JWKS URL from the token issuer so no extra config is needed.
    iss = jwt.decode(token, options={"verify_signature": False}).get("iss", "").rstrip("/")
    if not iss:
        raise HTTPException(status_code=401, detail="Invalid token.")
    signing_key = _jwks_client(f"{iss}/.well-known/jwks.json").get_signing_key_from_jwt(token)
    return jwt.decode(
        token, signing_key.key, algorithms=[alg], audience="authenticated"
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer),
) -> str:
    if not _JWT_SECRET:
        # Auth not configured — skip (dev mode).
        return "dev"
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    try:
        payload = _verify(credentials.credentials)
        return payload["sub"]  # Supabase user ID
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token.")
