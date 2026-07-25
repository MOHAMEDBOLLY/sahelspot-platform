"""Authentication — verifying who's making a request.

Deliberately its own package, same shape as `app/activity/`, `app/workflow/`,
`app/validation/`: one cross-cutting concern, isolated behind one reusable
dependency. This module never decides *what* an authenticated user is
allowed to do (no roles, no permissions) — Sprint 22 only answers "is this
a real, logged-in Supabase user or not." Every mutation route depends on
`get_current_user` instead of parsing/verifying a token itself, so the
verification logic (and the day it needs to change, e.g. to rotate a
secret or move to JWKS) only lives in one place.

The backend never talks to Supabase's Auth API and never issues or stores
tokens — it only verifies a JWT that Supabase already issued to the
frontend, using the project's JWT secret. This keeps the backend stateless
with respect to auth, consistent with "no premature abstraction": no user
table, no session store.
"""

from dataclasses import dataclass

import jwt
from fastapi import Header, HTTPException
from jwt import InvalidTokenError

from app.core.config import settings


@dataclass(frozen=True)
class CurrentUser:
    """The only two facts a route ever needs about the caller right now.
    Deliberately not "the full Supabase user object" — no roles/permissions
    concept exists yet (see Sprint 22 non-goals), so there is nothing else
    to carry here today.
    """

    id: str
    email: str | None


def get_current_user(authorization: str | None = Header(default=None)) -> CurrentUser:
    """FastAPI dependency: verifies the `Authorization: Bearer <token>`
    header against Supabase's JWT secret and returns the caller's identity.
    Raises `401` for anything short of a valid, unexpired, correctly-signed
    Supabase-issued token — missing header, malformed header, bad
    signature, and expiry are all the same "not authenticated" outcome to
    every caller of this dependency.
    """
    if authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header")

    token = authorization.removeprefix("Bearer ").strip()

    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing subject claim")

    return CurrentUser(id=user_id, email=payload.get("email"))
