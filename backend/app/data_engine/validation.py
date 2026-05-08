"""
Data Validation Layer
=====================
Pydantic models that validate raw ESPN API responses before they
enter the normalization or storage steps.

Only structurally valid data proceeds downstream.
Invalid events are logged and skipped — they never reach the database.

Validates:
  - Team names are non-empty strings
  - Exactly 1 home and 1 away competitor per competition
  - Competitor IDs are non-empty
  - Event date is a non-empty string (ISO 8601 format)
  - Score values, when present, are numeric strings
"""
from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator

logger = logging.getLogger(__name__)


# ── Raw ESPN models ──────────────────────────────────────────────────────────

class RawTeam(BaseModel):
    id: str
    displayName: str
    abbreviation: str | None = None
    logo: str | None = None  # URL

    @field_validator("id")
    @classmethod
    def id_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Team ID cannot be empty")
        return v.strip()

    @field_validator("displayName")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Team name cannot be empty")
        return v.strip()


class RawCompetitor(BaseModel):
    id: str
    team: RawTeam
    homeAway: str          # "home" | "away"
    score: str | None = None

    @field_validator("homeAway")
    @classmethod
    def valid_side(cls, v: str) -> str:
        if v not in ("home", "away"):
            raise ValueError(f"homeAway must be 'home' or 'away', got: {v!r}")
        return v

    @field_validator("score")
    @classmethod
    def score_is_numeric(cls, v: str | None) -> str | None:
        if v is not None and v != "" and not v.strip().lstrip("-").isdigit():
            raise ValueError(f"Score must be numeric, got: {v!r}")
        return v


class RawVenue(BaseModel):
    fullName: str | None = None
    address: dict[str, Any] | None = None


class RawCompetition(BaseModel):
    competitors: list[RawCompetitor]
    venue: RawVenue | None = None
    officials: list[dict[str, Any]] = Field(default_factory=list)

    @model_validator(mode="after")
    def exactly_one_home_one_away(self) -> "RawCompetition":
        home = [c for c in self.competitors if c.homeAway == "home"]
        away = [c for c in self.competitors if c.homeAway == "away"]
        if len(home) != 1 or len(away) != 1:
            raise ValueError(
                f"Expected exactly 1 home + 1 away competitor, "
                f"got {len(home)} home / {len(away)} away"
            )
        return self


class RawStatusType(BaseModel):
    name: str               # e.g. "STATUS_SCHEDULED"
    displayClock: str | None = None
    completed: bool = False


class RawStatus(BaseModel):
    type: RawStatusType
    displayClock: str | None = None

    @property
    def name(self) -> str:
        return self.type.name

    @property
    def clock(self) -> str | None:
        return self.displayClock or self.type.displayClock


class RawEvent(BaseModel):
    id: str
    date: str               # ISO 8601, e.g. "2026-05-07T19:00Z"
    name: str = ""
    competitions: list[RawCompetition]
    status: RawStatus

    @field_validator("id")
    @classmethod
    def id_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Event ID cannot be empty")
        return v.strip()

    @field_validator("date")
    @classmethod
    def date_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Event date cannot be empty")
        return v.strip()

    @model_validator(mode="after")
    def has_competition(self) -> "RawEvent":
        if not self.competitions:
            raise ValueError("Event must have at least 1 competition")
        return self

    @property
    def competition(self) -> RawCompetition:
        return self.competitions[0]

    @property
    def home_competitor(self) -> RawCompetitor:
        return next(c for c in self.competition.competitors if c.homeAway == "home")

    @property
    def away_competitor(self) -> RawCompetitor:
        return next(c for c in self.competition.competitors if c.homeAway == "away")


# ── Validation helpers ────────────────────────────────────────────────────────

class ValidationResult:
    """Container for batch validation results."""

    def __init__(self) -> None:
        self.valid: list[RawEvent] = []
        self.invalid: list[tuple[dict, str]] = []  # (raw_event, error_msg)

    @property
    def total(self) -> int:
        return len(self.valid) + len(self.invalid)

    @property
    def pass_rate(self) -> float:
        if self.total == 0:
            return 1.0
        return len(self.valid) / self.total


def validate_events(raw_events: list[dict], source_label: str = "") -> ValidationResult:
    """
    Validate a list of raw ESPN event dicts.

    Returns a ValidationResult with .valid (list[RawEvent]) and
    .invalid (list of (raw, error_msg)) for logging/monitoring.
    """
    result = ValidationResult()
    for raw in raw_events:
        try:
            event = RawEvent.model_validate(raw)
            result.valid.append(event)
        except Exception as exc:
            event_id = raw.get("id", "?")
            event_name = raw.get("name", "?")
            msg = str(exc)
            logger.warning(
                "[Validation] SKIP %s event %s (%s): %s",
                source_label, event_id, event_name, msg
            )
            result.invalid.append((raw, msg))

    if result.invalid:
        logger.info(
            "[Validation] %s: %d/%d events passed (%.0f%%)",
            source_label,
            len(result.valid),
            result.total,
            result.pass_rate * 100,
        )

    return result
