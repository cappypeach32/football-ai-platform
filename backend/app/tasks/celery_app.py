from celery import Celery
from app.config import settings

celery_app = Celery(
    "football_ai",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.prediction_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_routes={
        "app.tasks.prediction_tasks.*": {"queue": "predictions"},
        "app.tasks.analytics_tasks.*": {"queue": "analytics"},
    },
    beat_schedule={
        "fetch-daily-matches-every-3-hours": {
            "task": "app.tasks.prediction_tasks.fetch_daily_matches",
            "schedule": 10800.0,  # every 3 hours
        },
        "refresh-predictions-hourly": {
            "task": "app.tasks.prediction_tasks.refresh_upcoming_predictions",
            "schedule": 3600.0,
        },
        "update-live-matches-every-minute": {
            "task": "app.tasks.prediction_tasks.update_live_matches",
            "schedule": 60.0,
        },
        "reconcile-finished-predictions-every-5-minutes": {
            "task": "app.tasks.prediction_tasks.reconcile_finished_predictions",
            "schedule": 300.0,
        },
    },
)
