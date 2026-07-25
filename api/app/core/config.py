from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "SahelSpot API"
    app_version: str = "0.1.0"
    environment: str = "development"
    log_level: str = "INFO"
    database_url: str
    supabase_jwt_secret: str
    # Sprint 24 — the Supabase user id (sub claim) that gets bootstrapped as
    # `admin` on first login instead of the default `viewer`. Deliberately
    # not baked into the migration (see 0003_app_users.py) since it varies
    # per deployment. Optional: unset means no auto-promotion happens, and
    # the first admin row must be inserted manually.
    bootstrap_admin_user_id: str | None = None


settings = Settings()
