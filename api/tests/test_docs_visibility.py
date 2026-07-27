"""Security hardening PR 1 — the interactive API docs (`/docs`, `/redoc`,
`/openapi.json`) must be reachable in local development (where knowing the
API shape is the point) and disabled everywhere else, since they expose
the entire API surface with no auth.
"""

from app.core.config import Settings


class TestDocsEnabledSetting:
    """`Settings.docs_enabled` is a pure function of `environment` — tested
    directly rather than by spinning up a second app instance under a
    different environment, since `app.main`'s `FastAPI(...)` construction
    happens once, at import time, using whatever `environment` the test
    process already started with.
    """

    def test_enabled_in_development(self):
        settings = Settings(database_url="postgresql://x", supabase_jwt_secret="x", environment="development")
        assert settings.docs_enabled is True

    def test_disabled_in_production(self):
        settings = Settings(database_url="postgresql://x", supabase_jwt_secret="x", environment="production")
        assert settings.docs_enabled is False

    def test_disabled_in_staging(self):
        settings = Settings(database_url="postgresql://x", supabase_jwt_secret="x", environment="staging")
        assert settings.docs_enabled is False


class TestDocsReachableInTestEnvironment:
    """The test suite itself always runs with the default `environment`
    ("development", per `Settings`' own default — nothing in `.env`/CI
    overrides it), so these confirm the *enabled* path actually works
    end-to-end against the real running app, not just the setting.
    """

    def test_openapi_json_is_reachable(self, client):
        response = client.get("/openapi.json")
        assert response.status_code == 200

    def test_docs_is_reachable(self, client):
        response = client.get("/docs")
        assert response.status_code == 200

    def test_redoc_is_reachable(self, client):
        response = client.get("/redoc")
        assert response.status_code == 200
