"""Tests for the test-database isolation guard (`tests/database_guard.py`).

Pure logic — every function under test takes its environment as an
argument, so nothing here reads or mutates the real process environment,
and nothing here opens a database connection.

This file is the regression fence for an incident that actually happened:
the suite ran against the shared Supabase database, rewrote
`last_published_at` on hundreds of live rows, and left the platform with
no current publish revision (which blanks the entire public API). If a
future change weakens `assert_isolated`, these tests fail.
"""

import pytest

from tests.database_guard import (
    ALLOW_REMOTE_ENV_VAR,
    DEFAULT_TEST_DATABASE_URL,
    TEST_DATABASE_URL_ENV_VAR,
    UnsafeTestDatabaseError,
    assert_isolated,
    enforce_isolated_test_database,
    resolve_test_database_url,
)

# The real production host from the incident — kept verbatim so this test
# is anchored to the thing that actually went wrong, not a paraphrase.
PRODUCTION_URL = (
    "postgresql+psycopg://user:password@aws-0-eu-west-3.pooler.supabase.com:5432/postgres"
)
LOCAL_URL = "postgresql+psycopg://postgres:postgres@127.0.0.1:5432/sahelspot_test"


# `tests/conftest.py` has two autouse fixtures that touch the database
# (`_clean_global_tables`) and the app's auth overrides
# (`_authenticated_by_default`). Overriding them here — a standard pytest
# module-level fixture override — keeps this file pure logic, so the
# guard that protects every other test remains verifiable on a machine
# with no Postgres at all. That matters: a safety mechanism you can only
# check in CI is one you will not check.
@pytest.fixture(autouse=True)
def _clean_global_tables():
    yield


@pytest.fixture(autouse=True)
def _authenticated_by_default():
    yield


class TestForbiddenHostsAreUnconditional:
    def test_production_supabase_host_is_refused(self):
        with pytest.raises(UnsafeTestDatabaseError, match="REFUSING TO RUN TESTS"):
            assert_isolated(PRODUCTION_URL, environ={})

    def test_allow_remote_does_not_lift_the_forbidden_host_rule(self):
        """The escape hatch exists for a disposable remote database. It
        must never be a way to reach a managed provider."""
        with pytest.raises(UnsafeTestDatabaseError):
            assert_isolated(PRODUCTION_URL, environ={ALLOW_REMOTE_ENV_VAR: "1"})

    @pytest.mark.parametrize(
        "host",
        [
            "db.abcdefg.supabase.co",
            "aws-0-eu-west-3.pooler.supabase.com",
            "ep-cool-name.eu-central-1.neon.tech",
            "mydb.abc123.eu-west-1.rds.amazonaws.com",
        ],
    )
    def test_managed_provider_hosts_are_refused(self, host):
        with pytest.raises(UnsafeTestDatabaseError):
            assert_isolated(f"postgresql+psycopg://u:p@{host}:5432/postgres", environ={})

    def test_error_message_never_leaks_credentials(self):
        with pytest.raises(UnsafeTestDatabaseError) as excinfo:
            assert_isolated(PRODUCTION_URL, environ={})
        assert "password" not in str(excinfo.value)


class TestLoopbackRule:
    @pytest.mark.parametrize("host", ["localhost", "127.0.0.1", "0.0.0.0"])
    def test_loopback_hosts_are_accepted(self, host):
        assert_isolated(f"postgresql+psycopg://u:p@{host}:5432/sahelspot_test", environ={})

    def test_unrecognized_remote_host_is_refused_by_default(self):
        with pytest.raises(UnsafeTestDatabaseError, match="not a loopback"):
            assert_isolated("postgresql+psycopg://u:p@db.internal.example:5432/t", environ={})

    def test_unrecognized_remote_host_is_allowed_with_explicit_opt_in(self):
        assert_isolated(
            "postgresql+psycopg://u:p@db.internal.example:5432/t",
            environ={ALLOW_REMOTE_ENV_VAR: "1"},
        )

    def test_url_without_a_host_is_refused(self):
        with pytest.raises(UnsafeTestDatabaseError):
            assert_isolated("postgresql+psycopg:///sahelspot_test", environ={})


class TestResolution:
    def test_database_url_is_never_consulted(self):
        """The whole point: a developer's `.env` pointing at production
        must not be able to reach a test run."""
        resolved = resolve_test_database_url({"DATABASE_URL": PRODUCTION_URL})
        assert "supabase" not in resolved
        assert resolved == DEFAULT_TEST_DATABASE_URL

    def test_test_database_url_wins_when_set(self):
        assert resolve_test_database_url({TEST_DATABASE_URL_ENV_VAR: LOCAL_URL}) == LOCAL_URL

    def test_blank_test_database_url_falls_back_to_the_default(self):
        assert (
            resolve_test_database_url({TEST_DATABASE_URL_ENV_VAR: "   "})
            == DEFAULT_TEST_DATABASE_URL
        )

    def test_the_default_is_itself_safe(self):
        assert_isolated(DEFAULT_TEST_DATABASE_URL, environ={})


class TestEnforcement:
    def test_installs_the_safe_url_over_a_production_database_url(self):
        environ = {"DATABASE_URL": PRODUCTION_URL, TEST_DATABASE_URL_ENV_VAR: LOCAL_URL}

        returned = enforce_isolated_test_database(environ)

        assert returned == LOCAL_URL
        assert environ["DATABASE_URL"] == LOCAL_URL
        assert environ["SAHELSPOT_TEST_DB_ENFORCED"] == "1"

    def test_raises_and_leaves_database_url_untouched_when_unsafe(self):
        environ = {
            "DATABASE_URL": "postgresql+psycopg://u:p@127.0.0.1:5432/x",
            TEST_DATABASE_URL_ENV_VAR: PRODUCTION_URL,
        }

        with pytest.raises(UnsafeTestDatabaseError):
            enforce_isolated_test_database(environ)

        # Aborted before installing anything.
        assert environ["DATABASE_URL"] == "postgresql+psycopg://u:p@127.0.0.1:5432/x"
        assert "SAHELSPOT_TEST_DB_ENFORCED" not in environ


class TestGuardIsActiveInThisRun:
    def test_this_very_test_run_is_isolated(self):
        """Belt and braces: assert the running process actually went
        through the guard and is not pointed at a forbidden host."""
        import os

        from app.core.config import settings

        assert os.environ.get("SAHELSPOT_TEST_DB_ENFORCED") == "1"
        assert_isolated(settings.database_url, environ=os.environ)
