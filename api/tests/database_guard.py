"""Test-database isolation guard.

Background: this suite historically ran against the *shared Supabase
database* (see `docs/TESTING.md`). That was a real, realized hazard, not a
theoretical one — `publish()` stamps `last_published_at` on every approved
row and the suite issues dozens of publishes, so a routine `pytest` run
rewrote publish metadata on hundreds of live rows and (because
`_clean_global_tables` deletes the `publish_revisions` rows those
publishes create) left the database with **no current revision**, which
blanks the entire public API.

This module makes that outcome structurally impossible rather than a
matter of remembering to point `.env` somewhere safe. It runs from
`api/conftest.py` — the root conftest, loaded by pytest before
`tests/conftest.py` and therefore before anything imports
`app.core.config` or builds the SQLAlchemy engine.

Two rules, in order of strictness:

1. **Known managed-database hosts are refused unconditionally.** There is
   no escape hatch, no env var, no flag. If the resolved URL points at
   Supabase (or another recognized managed provider), the run aborts.
2. **Non-loopback hosts are refused by default.** A deliberate
   `ALLOW_REMOTE_TEST_DATABASE=1` lifts this one, for the legitimate case
   of a disposable database on another machine. Rule 1 still applies on
   top of it.

The resolved URL comes from `TEST_DATABASE_URL`, or a local default.
`DATABASE_URL` is **deliberately never consulted** — that variable is the
application's production-facing configuration, and the entire point here
is that a developer's working `.env` cannot leak into a test run.

Nothing in this module is imported by application code, and it changes no
production code path: it only decides which database a `pytest` process
is allowed to talk to.
"""

from __future__ import annotations

import os
from urllib.parse import urlparse

# A local, disposable database. Used when `TEST_DATABASE_URL` is unset so
# that the common case needs no configuration at all — and so that an
# unconfigured run fails by not finding a *local* database, rather than by
# succeeding against a remote one.
DEFAULT_TEST_DATABASE_URL = (
    "postgresql+psycopg://postgres:postgres@127.0.0.1:5432/sahelspot_test"
)

# Matched as substrings of the URL's hostname. Deliberately broad: the
# cost of a false positive is a developer setting one env var, while the
# cost of a false negative is what this module exists to prevent.
FORBIDDEN_HOST_SUBSTRINGS = (
    "supabase.co",
    "supabase.com",
    "supabase.in",
    "pooler.supabase",
    "rds.amazonaws.com",
    "neon.tech",
    "render.com",
    "digitalocean.com",
    "azure.com",
    "googleapis.com",
    "cockroachlabs.cloud",
    "planetscale",
)

LOOPBACK_HOSTS = frozenset({"localhost", "127.0.0.1", "::1", "0.0.0.0"})

ALLOW_REMOTE_ENV_VAR = "ALLOW_REMOTE_TEST_DATABASE"
TEST_DATABASE_URL_ENV_VAR = "TEST_DATABASE_URL"


class UnsafeTestDatabaseError(RuntimeError):
    """Raised when the resolved test database is not provably isolated.

    Deliberately a hard error at collection time, not a warning or a skip:
    a run that cannot prove its own isolation must not proceed to open a
    connection at all.
    """


def _safe_display(url: str) -> str:
    """A URL with any credentials stripped, for error messages. Never let
    this module be the thing that prints a password into a CI log."""
    parsed = urlparse(url)
    host = parsed.hostname or "?"
    port = f":{parsed.port}" if parsed.port else ""
    return f"{parsed.scheme}://{host}{port}{parsed.path}"


def host_of(url: str) -> str:
    return (urlparse(url).hostname or "").lower()


def assert_isolated(url: str, *, environ: dict | None = None) -> None:
    """Raises `UnsafeTestDatabaseError` unless `url` is provably a
    disposable test database. See this module's docstring for the two
    rules and why only one of them is overridable."""
    environ = os.environ if environ is None else environ
    host = host_of(url)

    if not host:
        raise UnsafeTestDatabaseError(
            f"Could not determine a database host from {TEST_DATABASE_URL_ENV_VAR}"
            f" ({_safe_display(url)}). Refusing to run tests against an"
            " unidentifiable database."
        )

    # Rule 1 — unconditional. No env var lifts this.
    for marker in FORBIDDEN_HOST_SUBSTRINGS:
        if marker in host:
            raise UnsafeTestDatabaseError(
                f"REFUSING TO RUN TESTS: the resolved test database host '{host}'"
                f" matches the forbidden pattern '{marker}', which identifies a"
                " managed/production database provider.\n"
                "This suite destroys data (it publishes, deletes, and rewrites"
                " editorial rows) and must only ever run against a disposable"
                " database.\n"
                f"Set {TEST_DATABASE_URL_ENV_VAR} to a local, disposable Postgres"
                " (see docs/TESTING.md). There is no override for this check."
            )

    # Rule 2 — overridable, for a disposable database that isn't local.
    if host not in LOOPBACK_HOSTS and environ.get(ALLOW_REMOTE_ENV_VAR) != "1":
        raise UnsafeTestDatabaseError(
            f"REFUSING TO RUN TESTS: the resolved test database host '{host}' is not"
            " a loopback address, so this run cannot prove the database is"
            " disposable.\n"
            f"Either point {TEST_DATABASE_URL_ENV_VAR} at a local Postgres, or — if"
            " this really is a throwaway database on another host — set"
            f" {ALLOW_REMOTE_ENV_VAR}=1 to acknowledge that explicitly."
        )


def resolve_test_database_url(environ: dict | None = None) -> str:
    """The test database URL: `TEST_DATABASE_URL`, else the local default.

    `DATABASE_URL` is never read here — see the module docstring.
    """
    environ = os.environ if environ is None else environ
    configured = (environ.get(TEST_DATABASE_URL_ENV_VAR) or "").strip()
    return configured or DEFAULT_TEST_DATABASE_URL


def enforce_isolated_test_database(environ: dict | None = None) -> str:
    """Resolve, validate, and install the test database URL.

    Installing means setting `DATABASE_URL` in the process environment:
    `app.core.config.Settings` reads `.env` but environment variables take
    precedence over it in pydantic-settings, so this overrides whatever a
    developer's `.env` holds — without modifying that file. Everything
    downstream (`app.db.session`'s engine, and Alembic if invoked in the
    same process) then inherits the safe URL with no application code
    change of any kind.

    Must be called before the first import of `app.*`.
    """
    environ = os.environ if environ is None else environ
    url = resolve_test_database_url(environ)
    assert_isolated(url, environ=environ)
    environ["DATABASE_URL"] = url
    # Marker other code (and the guard's own tests) can assert on.
    environ["SAHELSPOT_TEST_DB_ENFORCED"] = "1"
    return url
