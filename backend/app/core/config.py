from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings, read from environment variables or backend/.env (see .env.example)."""

    model_config = SettingsConfigDict(env_file=".env")

    app_name: str = "Posh Paws API"
    # Front-ends allowed to call the API: customer (4200) and admin (4300) in development.
    cors_origins: List[str] = ["http://localhost:4200", "http://localhost:4300"]


settings = Settings()
