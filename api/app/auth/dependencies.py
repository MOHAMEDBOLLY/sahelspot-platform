"""Authentication — verifying who's making a request, and (Sprint 24) what
role that identity holds here.

Deliberately its own package, same shape as `app/activity/`, `app/workflow/`,
`app/validation/`: one cross-cutting concern, isolated behind one reusable
dependency. This module answers two questions and no more: "is this a
real, logged-in Supabase user" and "what role does `app_users` say they
have." It never decides what a role is *allowed* to do — that's
`app/auth/permissions.py`'s job, kept deliberately separate so a route
never has to know a role name exists at all (see that module's docstring).

The backend never talks to Supabase's Auth API and never issues or stores
tokens — it only verifies a JWT that Supabase already issued to the
frontend, using the project's JWT secret. This keeps the backend stateless
with respect to auth beyond the one small `app_users` table Sprint 24 adds.
"""

import logging
from dataclasses import dataclass

import jwt
from fastapi import Depends, Header, HTTPException, Request
from jwt import ExpiredSignatureError, InvalidTokenError, PyJWKClient, PyJWKClientError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.activity.service import log_activity
from app.core.config import settings
from app.db.models import AppUser
from app.db.session import get_db

logger = logging.getLogger(__name__)

# Supabase's asymmetric JWT signing keys (its current default — "JWT
# Signing Keys" in the dashboard, replacing the legacy shared secret).
# Tokens are signed with a private key that never leaves Supabase and are
# verified here against the matching public key from the project's JWKS
# endpoint. ES256 is what Supabase issues by default today; RS256 is the
# other option a project can be configured with.
_ASYMMETRIC_ALGORITHMS = ["RS256", "ES256"]

# Built lazily and kept at module scope so the JWK set is fetched once and
# reused across requests rather than re-fetched per call. `PyJWKClient`
# owns the caching and rotation behavior: it serves keys from its cached
# JWK set, and re-fetches when a token presents a `kid` it hasn't seen —
# which is exactly what makes a Supabase key rotation self-healing here,
# with no redeploy and no config change.
_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient | None:
    """`None` when `SUPABASE_URL` isn't configured — there's no JWKS
    endpoint to derive without it. Callers must treat that as a hard
    verification failure (401), never as "skip verification".
    """
    global _jwks_client
    if _jwks_client is None and settings.supabase_url:
        _jwks_client = PyJWKClient(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json",
            cache_keys=True,
            lifespan=300,
        )
    return _jwks_client


def _decode_token(token: str) -> dict:
    """Verifies and decodes a Supabase-issued JWT, returning its claims.

    The verification path is chosen from the token's own `alg` header, but
    the *key material* for each path is strictly segregated and never
    interchangeable: an asymmetric token is only ever checked against a
    JWKS public key, and an HS256 token only ever against the shared
    secret. That separation is what makes reading `alg` from the token
    safe here — the algorithm-confusion attack this would otherwise invite
    needs one key to be usable by both families (classically, feeding an
    RSA *public* key in as an HMAC secret), and no path below can do that.
    Each `jwt.decode` call is also given a single, fixed algorithm
    allow-list rather than one combined list, for the same reason.

    HS256 is kept because a project that hasn't migrated to asymmetric
    signing keys still issues those, and dropping it would break every
    such deployment (and this suite's own token-minting tests) for no
    security gain — the shared secret is still a secret.
    """
    algorithm = jwt.get_unverified_header(token).get("alg")

    if algorithm in _ASYMMETRIC_ALGORITHMS:
        jwks_client = _get_jwks_client()
        if jwks_client is None:
            raise InvalidTokenError("SUPABASE_URL is not configured; cannot verify an asymmetric token")
        return jwt.decode(
            token,
            jwks_client.get_signing_key_from_jwt(token).key,
            algorithms=_ASYMMETRIC_ALGORITHMS,
            audience="authenticated",
        )

    return jwt.decode(
        token,
        settings.supabase_jwt_secret,
        algorithms=["HS256"],
        audience="authenticated",
    )


def log_auth_failure(request: Request, *, event: str, reason: str, user_id: str | None = None) -> None:
    """Security hardening PR 5 — one consistent log line for every
    authentication/authorization failure, called from both this module's
    401 paths and `app/auth/permissions.py`'s 403 path. Deliberately never
    logs the `Authorization` header, the token itself, or any request
    body — only the safe metadata the request already exposes (path,
    method, client IP) plus a short, fixed `reason` string and, where the
    caller is already known (the 403 case only — a 401 caller is by
    definition not yet identified), their `user_id`. Uses `.warning`, not
    `.exception`: these are expected, frequent, non-exceptional outcomes
    (someone's token expired, not a bug), the same reasoning that already
    separates `logger.exception` (bugs) from ordinary rejection paths
    elsewhere in this codebase.
    """
    client_ip = request.client.host if request.client else "unknown"
    logger.warning(
        "auth_failure event=%s path=%s method=%s client_ip=%s user_id=%s reason=%s",
        event,
        request.url.path,
        request.method,
        client_ip,
        user_id or "-",
        reason,
    )


@dataclass(frozen=True)
class CurrentUser:
    """The facts a route needs about the caller. `role` was added in
    Sprint 24 — every route that already depended on this dataclass for
    `id`/`email` gets it for free, no signature change needed on their end.
    """

    id: str
    email: str | None
    role: str


def _provision_viewer(db: Session, *, user_id: str, email: str | None) -> AppUser:
    """First login for this Supabase identity — no `app_users` row exists
    yet. Defaults to `viewer`, the lowest-privilege role, except for the
    one configured bootstrap admin id (see `Settings.bootstrap_admin_user_id`)
    — there is no other way to become `admin` in this sprint; role changes
    beyond this one bootstrap rule are a deferred feature (`PATCH
    /editor/users/{id}`, not built yet).

    This *is* a role change (none -> a real role), so it's activity-logged
    the same way every other editorial action is — `actor` is the newly
    provisioned user themselves, since logging in is what triggered it.

    Two simultaneous first requests from the same identity (e.g. a
    double-click, or two tabs restoring a session at once) both see no
    existing row and both attempt this insert — a real race, not a
    hypothetical one. Only one commit can win; the other hits `app_users`'
    primary-key constraint. Rather than let that surface as an unhandled
    `500`, the loser rolls back its own insert (and the activity entry
    that would have duplicated the winner's) and reads the row the winner
    already committed — the caller gets a normal, successful response
    either way, attributing exactly one `role_assigned` entry per user.
    """
    role = "admin" if user_id == settings.bootstrap_admin_user_id else "viewer"
    app_user = AppUser(id=user_id, email=email, role=role)
    db.add(app_user)
    log_activity(
        db,
        action="role_assigned",
        entity_type="app_user",
        entity_id=user_id,
        actor=user_id,
        metadata={"role": role},
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        app_user = db.get(AppUser, user_id)
        assert app_user is not None  # the only reason this insert could conflict
    return app_user


def get_current_user(
    request: Request,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> CurrentUser:
    """FastAPI dependency: verifies the `Authorization: Bearer <token>`
    header against Supabase's JWT secret, then resolves the caller's role
    from `app_users` — auto-provisioning a `viewer` row on first login
    rather than rejecting an otherwise-valid Supabase user. Raises `401`
    for anything short of a valid, unexpired, correctly-signed
    Supabase-issued token — missing header, malformed header, bad
    signature, and expiry are all the same "not authenticated" outcome to
    every caller of this dependency. Never raises `403` here — role
    *sufficiency* for a given action is `require_permission()`'s job, not
    this function's.

    Security hardening PR 5 — `request` is a new parameter, added only so
    each rejection path can log via `log_auth_failure`; it's not used for
    any decision here, and no response/status code below changed.
    """
    if authorization is None or not authorization.startswith("Bearer "):
        log_auth_failure(request, event="missing_token", reason="missing or malformed Authorization header")
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header")

    token = authorization.removeprefix("Bearer ").strip()

    try:
        payload = _decode_token(token)
    except ExpiredSignatureError:
        log_auth_failure(request, event="expired_token", reason="token expired")
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    except InvalidTokenError:
        log_auth_failure(request, event="invalid_token", reason="token failed validation")
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    # `PyJWKClientError` is *not* an `InvalidTokenError` subclass, so
    # without this it would escape as an unhandled 500 rather than a 401.
    # Covers the JWKS endpoint being unreachable and a `kid` with no
    # matching key: both mean "this token could not be verified", so both
    # fail closed, exactly like any other unverifiable token. Logged as
    # its own event since the cause is infrastructure, not the caller —
    # a spike here is an outage signal, not a wave of bad tokens.
    except PyJWKClientError:
        log_auth_failure(request, event="jwks_unavailable", reason="signing key could not be retrieved")
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = payload.get("sub")
    if not user_id:
        log_auth_failure(request, event="invalid_token", reason="token missing subject claim")
        raise HTTPException(status_code=401, detail="Token missing subject claim")

    email = payload.get("email")

    app_user = db.get(AppUser, user_id)
    if app_user is None:
        app_user = _provision_viewer(db, user_id=user_id, email=email)

    return CurrentUser(id=user_id, email=email, role=app_user.role)
