from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "SahelSpot API"
    app_version: str = "0.1.0"
    environment: str = "development"
    log_level: str = "INFO"
    # Security hardening — both were already required (no default, so
    # pydantic-settings already fails fast if the env var is absent
    # entirely). `min_length=1` closes the one gap that left: an env var
    # that's *set but empty* (e.g. `DATABASE_URL=` with nothing after it)
    # previously passed as a valid empty string, only to fail later with a
    # more confusing error somewhere downstream (a connection string parse
    # failure, a JWT decode failure) instead of failing here, immediately,
    # with a clear reason.
    database_url: str = Field(min_length=1)
    supabase_jwt_secret: str = Field(min_length=1)
    # Sprint 30 — comma-separated list of origins allowed to call this API
    # from a browser (CORSMiddleware's allow_origins). Defaults to the
    # Studio dev server so local dev keeps working unconfigured; production
    # deployments must set this explicitly. No wildcard support — every
    # deployed frontend origin must be listed.
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    # Sprint 24 — the Supabase user id (sub claim) that gets bootstrapped as
    # `admin` on first login instead of the default `viewer`. Deliberately
    # not baked into the migration (see 0003_app_users.py) since it varies
    # per deployment. Optional: unset means no auto-promotion happens, and
    # the first admin row must be inserted manually.
    bootstrap_admin_user_id: str | None = None
    # Sprint 25 — Media Library Foundation. Optional: media upload returns a
    # clear 503 if unset rather than the app failing to start, since not
    # every environment needs media upload configured to run everything else.
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    media_bucket: str = "venue-media"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def docs_enabled(self) -> bool:
        """Security hardening PR 1 — the interactive API docs (`/docs`,
        `/redoc`, `/openapi.json`) expose the entire API surface (routes,
        schemas, permission requirements) with no auth. Fine for local
        development; not something a public deployment should serve for
        free. Only `development` gets them — everything else (staging,
        production, anything else configured) is treated as public-facing
        and gets them disabled, same split `allowed_origins`'s own
        development-only default already uses.
        """
        return self.environment == "development"


settings = Settings()
