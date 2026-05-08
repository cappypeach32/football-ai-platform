"""
Match Data Engine
=================
Central football data aggregation layer.

Pipeline:
    Football APIs
         ↓
    Data Validation      (validation.py)
         ↓
    Normalization        (normalization.py)
         ↓
    Caching              (cache.py)
         ↓
    Database Storage     (pipeline.py)
         ↓
    Analytics Engine     (app/ai/engine.py)

Sources:
    sources/espn.py  — ESPN public API (no key required)

Usage:
    from app.data_engine.pipeline import ingest_date
    from app.data_engine.sources.espn import espn
    from app.data_engine.cache import cache
"""
from app.data_engine.cache import cache
from app.data_engine.pipeline import ingest_date, refresh_live_matches

__all__ = ["cache", "ingest_date", "refresh_live_matches"]
