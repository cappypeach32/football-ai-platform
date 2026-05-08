from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "Football AI Platform"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Security
    SECRET_KEY: str = "your-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://fai_user:fai_secret@localhost:5432/football_ai"

    # Redis
    REDIS_URL: str = "redis://:redis_secret@localhost:6379/0"

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    # External APIs
    FOOTBALL_DATA_API_KEY: str = ""
    ODDS_API_KEY: str = ""
    RAPIDAPI_KEY: str = ""
    API_FOOTBALL_KEY: str = ""

    # Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAILS_FROM_EMAIL: str = "noreply@football-ai.com"
    EMAILS_FROM_NAME: str = "Football AI Platform"

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PREMIUM_PRICE_ID: str = ""
    STRIPE_VIP_PRICE_ID: str = ""

    # Model cache
    MODEL_CACHE_DIR: str = "./app/ai/models"

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


_INSECURE_KEY = "your-super-secret-key-change-in-production"


@lru_cache()
def get_settings() -> Settings:
    s = Settings()
    if s.ENVIRONMENT == "production" and s.SECRET_KEY == _INSECURE_KEY:
        raise RuntimeError(
            "SECRET_KEY must be changed from the default value before running in production. "
            "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
        )
    if s.ENVIRONMENT == "production" and len(s.SECRET_KEY) < 32:
        raise RuntimeError("SECRET_KEY must be at least 32 characters in production.")
    return s


settings = get_settings()
