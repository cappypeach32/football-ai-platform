"""
Match importer — thin CLI wrapper over the data_engine pipeline.

Usage:
    python fetch_matches.py              # today
    python fetch_matches.py 2026-05-07  # specific date

All logic lives in app/data_engine/pipeline.py.
"""
import asyncio
import logging
import sys
from datetime import date

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")

from app.data_engine.pipeline import ingest_date


async def main() -> None:
    target: date | None = None
    if len(sys.argv) > 1:
        try:
            target = date.fromisoformat(sys.argv[1])
        except ValueError:
            print(f"Invalid date: {sys.argv[1]}. Use YYYY-MM-DD format.")
            sys.exit(1)

    result = await ingest_date(target)
    print(f"\n✅  {result}")


if __name__ == "__main__":
    asyncio.run(main())
