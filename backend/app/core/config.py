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
    # Signs the sign-in tokens. Anyone who knows it could make tokens, so online it's a long random value set
    # in the host's settings (SECRET_KEY), never in the code. This default only works on your own Mac.
    secret_key: str = "dev-only-not-secret-use-a-long-random-key-online"
    # How long a sign-in lasts before staff sign in again.
    token_days: int = 7
    # The shop's timezone: "today", opening hours and slots are in Pune time, wherever the server runs.
    timezone: str = "Asia/Kolkata"
    # Front-ends allowed to call the API: customer (4200) and admin (4300) in development.
    cors_origins: List[str] = ["http://localhost:4200", "http://localhost:4300"]
    # The API's own address, for links to uploaded photos (the apps load them from here).
    public_url: str = "http://localhost:8000"
    # Uploaded photos on your Mac: this folder, served at /uploads. Online they go to a photo storage bucket instead (at the deploy).
    upload_dir: str = "uploads"


settings = Settings()
