from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "SahelSpot API"
    app_version: str = "0.1.0"
    environment: str = "development"
    log_level: str = "INFO"
    database_url: str
    supabase_jwt_secret: str
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


settings = Settings()
