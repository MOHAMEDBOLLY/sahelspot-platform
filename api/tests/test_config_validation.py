"""Security hardening — `DATABASE_URL`/`SUPABASE_JWT_SECRET` were already
required (no default), so `Settings()` already failed fast if either was
completely absent. These tests cover the one gap that left: an env var
that's *set but empty*.
"""

import pytest
from pydantic import ValidationError

from app.core.config import Settings


class TestRequiredSettingsRejectEmptyValues:
    def test_empty_database_url_fails_validation(self):
        with pytest.raises(ValidationError):
            Settings(database_url="", supabase_jwt_secret="a-real-secret")

    def test_empty_supabase_jwt_secret_fails_validation(self):
        with pytest.raises(ValidationError):
            Settings(database_url="postgresql://x", supabase_jwt_secret="")

    def test_non_empty_values_still_construct_normally(self):
        # Confirms this didn't become stricter than "non-empty" — no
        # minimum length or format requirement was added.
        settings = Settings(database_url="postgresql://x", supabase_jwt_secret="x")
        assert settings.database_url == "postgresql://x"
        assert settings.supabase_jwt_secret == "x"
