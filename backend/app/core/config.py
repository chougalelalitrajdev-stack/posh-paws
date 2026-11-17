from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings, read from environment variables or backend/.env (see .env.example)."""

    model_config = SettingsConfigDict(env_file=".env")

    app_name: str = "Posh Paws API"
    # Where the database is. On the Mac: the local posh_paws database (no password needed).
    # Online, the host sets DATABASE_URL to the real address, with its password.
    database_url: str = "postgresql+psycopg://localhost:5432/posh_paws"
    # Print every query the backend sends to the database in the server's terminal (for learning and debugging).
    sql_echo: bool = False
    # Front-ends allowed to call the API: customer (4200) and admin (4300) in development.
    cors_origins: List[str] = ["http://localhost:4200", "http://localhost:4300"]


settings = Settings()
