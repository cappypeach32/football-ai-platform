#!/bin/bash
set -e

echo "=== Running database migrations ==="
alembic upgrade head

echo "=== Seeding leagues and teams (skips if already done) ==="
python seed.py

echo "=== Fetching today's matches ==="
TODAY=$(python3 -c "from datetime import date; print(date.today())")
TOMORROW=$(python3 -c "from datetime import date, timedelta; print(date.today()+timedelta(days=1))")
python fetch_matches.py "$TODAY" || echo "Warning: today fetch failed, continuing..."
python fetch_matches.py "$TOMORROW" || echo "Warning: tomorrow fetch failed, continuing..."

echo "=== Generating predictions ==="
python generate_predictions.py || echo "Warning: predictions failed, continuing..."

echo "=== Starting server on port ${PORT:-8000} ==="
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
