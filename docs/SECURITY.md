# Security

What's actually implemented today, and why — not a policy document, a
reference for what to expect when reading `api/app/main.py`,
`consumer/next.config.ts`, or either app's CI job. See `docs/DEPLOYMENT.md`
for how to run this in production and `docs/RUNBOOK.md` for day-to-day
operations.

## OpenAPI documentation

`/docs`, `/redoc`, and `/openapi.json` are only served when
`Settings.environment == "development"` (`app/core/config.py`'s
`docs_enabled` property). Anything else — staging, production, or
whatever else gets configured — gets all three disabled (FastAPI returns
`404`), since they expose the entire API surface (every route, schema,
and permission requirement) with no authentication of their own.

## Security headers

Both apps set the same four conservative, low-compatibility-risk headers
on every response:

| Header | Value |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `X-Frame-Options` | `DENY` |

API: `security_headers_middleware` in `app/main.py`. Consumer: the
`headers()` function in `next.config.ts`.

**Deliberately not included yet**: `Content-Security-Policy`, HSTS, COOP,
COEP, CORP. Each needs its own dedicated scoping (a CSP in particular
needs a real inventory of every script/style/image source before it can
be written safely) — see Outstanding items in the most recent hardening
PR for the current state of that decision.

## CORS

Configured in `app/main.py` via `CORSMiddleware`:

- **Origins**: `Settings.allowed_origins` (env-driven, comma-separated,
  no wildcard). Every deployed frontend origin must be listed explicitly.
- **Credentials**: not enabled (`allow_credentials` left at its default
  `False`) — there's no cookie-based session to protect; every
  authenticated request carries an explicit `Authorization: Bearer
  <token>` header instead, which a cross-site request can't attach on a
  victim's behalf. This is also why CSRF protection isn't implemented:
  the attack this defends against doesn't apply to bearer-token auth.
- **Methods**: `GET, PATCH, POST, DELETE` — exactly what the API uses.
- **Headers**: `Authorization, Content-Type` — exactly the two headers
  either frontend ever sends (verified directly against both apps' API
  clients), not a wildcard.

## Authentication failure logging

Every rejection path in `app/auth/dependencies.py`'s `get_current_user`
(missing/malformed header, invalid signature, expired token, missing
subject claim) and `app/auth/permissions.py`'s `require_permission` (403,
insufficient role) logs one `WARNING`-level line via `log_auth_failure()`:

```
auth_failure event=<event> path=<path> method=<method> client_ip=<ip> user_id=<id-or-"-"> reason=<reason>
```

**Never logged**: the token itself, the `Authorization` header, or any
request body. `user_id` is only included for the 403 case, where the
caller is by definition already authenticated — never for a 401, where no
identity exists yet to log.

## Container security

The API image (`api/Dockerfile`) runs as a dedicated, unprivileged system
user (`appuser`), not root. `useradd --system --no-create-home --shell
/usr/sbin/nologin` plus `chown -R /app` — the account can read the
application code and installed packages, and write to `/tmp` (upload
spooling), and nothing else.

## Media upload validation

`app/media/service.py`'s `upload_image()`:

- **Content-type**: verified against the file's actual magic bytes
  (JPEG/PNG/WEBP signatures), not just the client-declared
  `Content-Type` header — a mismatch between the two is rejected.
- **Filename**: sanitized (`PurePosixPath(...).name` + a character
  allowlist) before it's used in the storage path, preventing path
  traversal via a crafted filename.
- **Size**: capped at 5 MB, enforced in two places — an early rejection
  based on the request's `Content-Length` header
  (`reject_if_declared_too_large`, before the body is read at all) where
  that header is present, and an authoritative check on the actual byte
  count after reading, which remains the real limit for any request this
  can't pre-empt (e.g. chunked transfer encoding with no `Content-Length`).

**Not implemented**: malware/virus scanning of uploaded files. Tracked as
a known gap, appropriate for a small trusted editorial team, not yet
closed for a fully public-upload scenario.

## Environment configuration

`Settings` (`app/core/config.py`) uses pydantic-settings, reading from
`.env`/the real environment — no change to any variable name. Two fields
were already required with no default (`DATABASE_URL`,
`SUPABASE_JWT_SECRET`), so the app already failed to start if either was
completely absent; both now also reject an empty string specifically
(`Field(min_length=1)`), so a `DATABASE_URL=` with nothing after the `=`
fails immediately at startup with a clear validation error, instead of
failing later with a more confusing error from whatever first tried to
use the empty value.

## Dependency vulnerability scanning

CI (`.github/workflows/ci.yml`) runs:

- **`pip-audit`** against `api/requirements.txt` — **blocking**. Clean as
  of this writing; a newly-disclosed CVE in a pinned version fails the
  build.
- **`npm audit --audit-level=high`** in both `datalab-next` and
  `consumer` — **reporting only** (`continue-on-error: true`), not
  blocking. Both currently have real findings whose only available fixes
  are breaking dependency upgrades:
  - `datalab-next`: a real high-severity `react-router` advisory
    (RSC Mode CSRF Bypass) with a fix requiring a breaking downgrade of
    `react-router-dom`.
  - `consumer`: `npm audit`'s findings here are noise — `postcss`/`sharp`
    are transitive dependencies bundled inside `next` itself, and npm's
    suggested "fix" is a downgrade to a much older, unrelated Next.js
    major version, not a real remediation.

  Making either blocking today would fail every CI run over issues that
  need a deliberate upgrade decision, not a config change — tracked as an
  open item, not silently ignored.

## Known gaps (not yet implemented)

- Rate limiting on any endpoint.
- Content-Security-Policy, HSTS, COOP, COEP, CORP.
- Malware/virus scanning on media uploads.
- The `react-router` upgrade needed to resolve its current advisory.
- Reverse-proxy-level request size limits (assumed to exist at the
  infrastructure layer per `docs/DEPLOYMENT.md`, not enforced by this
  codebase itself).
