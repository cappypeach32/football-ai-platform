"""One-time script to create all SQLite tables from SQLAlchemy models."""
import asyncio
from app.database import engine, Base
import app.models  # noqa — registers all models


async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ All tables created successfully.")


if __name__ == "__main__":
    asyncio.run(main())
