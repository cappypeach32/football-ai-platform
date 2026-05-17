# Football AI Platform — API Reference

Base URL: `https://your-backend-domain/api`  
All responses are JSON. All dates are ISO 8601 UTC strings.

---

## Authentication

### POST `/auth/register`
Register a new user.

**Request body:**
```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "full_name": "John Doe",
  "password": "Secret1!"
}
```
Password rules: min 8 chars, 1 uppercase, 1 digit, 1 special character.

**Response: `201`**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "johndoe",
    "full_name": "John Doe",
    "role": "user",
    "is_active": true,
    "is_verified": false,
    "created_at": "2026-05-17T10:00:00Z",
    "subscription_plan": "free"
  }
}
```

---

### POST `/auth/login`
Login with email and password.

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "Secret1!"
}
```

**Response: `200`** — same structure as `/auth/register`

---

### GET `/auth/me`
Get current logged-in user.  
**Headers:** `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "johndoe",
  "full_name": "John Doe",
  "role": "user",
  "is_active": true,
  "is_verified": false,
  "created_at": "2026-05-17T10:00:00Z",
  "subscription_plan": "free"
}
```

---

## Predictions

### GET `/predictions/`
List all predictions with filters.

**Query params:**
| Param | Type | Default | Description |
|---|---|---|---|
| `league_id` | int | — | Filter by league |
| `min_confidence` | float | 0 | Minimum confidence score (0–100) |
| `value_bets_only` | bool | false | Only value bets |
| `upcoming_only` | bool | true | Only future matches |
| `team_name` | string | — | Filter by team name (partial match) |
| `from_date` | date | — | Floor date `YYYY-MM-DD` |
| `limit` | int | 20 | Max results (max 100) |
| `offset` | int | 0 | Pagination offset |

**Response: `200` — array of `PredictionResponse`**
```json
[
  {
    "id": 1,
    "match": {
      "id": 36,
      "league": {
        "id": 17,
        "external_id": "ITA.1",
        "name": "Serie A",
        "country": "Italy",
        "logo_url": "https://...",
        "season": "2025-26",
        "tier": 1
      },
      "home_team": {
        "id": 120,
        "name": "Inter Milan",
        "short_name": "INT",
        "logo_url": "https://...",
        "country": "Italy",
        "elo_rating": 1870.0,
        "form_score": 0.0,
        "attack_strength": 1.72,
        "defense_weakness": 0.65
      },
      "away_team": {
        "id": 121,
        "name": "Hellas Verona",
        "short_name": "VER",
        "logo_url": "https://...",
        "country": "Italy",
        "elo_rating": 1420.0,
        "form_score": 0.0,
        "attack_strength": 0.85,
        "defense_weakness": 1.35
      },
      "match_date": "2026-05-17T13:00:00Z",
      "status": "scheduled",
      "home_score": null,
      "away_score": null,
      "minute": null,
      "venue": "Stadio Giuseppe Meazza",
      "stats": null
    },
    "home_win_prob": 0.651,
    "draw_prob": 0.211,
    "away_win_prob": 0.138,
    "over_25_prob": 0.712,
    "under_25_prob": 0.288,
    "btts_yes_prob": 0.543,
    "btts_no_prob": 0.457,
    "home_xg": 2.14,
    "away_xg": 0.87,
    "confidence_score": 58.0,
    "risk_score": 32.0,
    "risk_category": "Balanced",
    "value_bet": true,
    "recommended_bet": "1",
    "ai_summary": "Inter Milan are heavy favourites...",
    "tactical_notes": null,
    "key_factors": ["Inter unbeaten at home (8 games)", "Verona without top scorer"],
    "odds_home": null,
    "odds_draw": null,
    "odds_away": null,
    "model_agreement": 3,
    "ah_line": null,
    "result": "pending",
    "model_version": "xgb-v2",
    "created_at": "2026-05-17T06:30:00Z"
  }
]
```

**Field reference:**

| Field | Type | Description |
|---|---|---|
| `home_win_prob` | float 0–1 | Probability of home win |
| `draw_prob` | float 0–1 | Probability of draw |
| `away_win_prob` | float 0–1 | Probability of away win |
| `over_25_prob` | float 0–1 | Probability of over 2.5 goals |
| `under_25_prob` | float 0–1 | Probability of under 2.5 goals |
| `btts_yes_prob` | float 0–1 | Both teams to score — yes |
| `btts_no_prob` | float 0–1 | Both teams to score — no |
| `home_xg` | float | Expected goals for home team |
| `away_xg` | float | Expected goals for away team |
| `confidence_score` | float 0–100 | AI model confidence in prediction |
| `risk_score` | float 0–100 | Risk level (higher = riskier) |
| `risk_category` | string | `"Safe"` / `"Balanced"` / `"Aggressive"` / `"High Variance"` |
| `value_bet` | bool | True if AI finds value vs market odds |
| `recommended_bet` | string | `"1"` (home) / `"X"` (draw) / `"2"` (away) / `"OVER_2.5"` / `"BTTS"` |
| `ai_summary` | string | Natural language match summary |
| `tactical_notes` | string\|null | Tactical analysis |
| `key_factors` | string[] | List of key influencing factors |
| `odds_home` | float\|null | Bookmaker odds for home win |
| `odds_draw` | float\|null | Bookmaker odds for draw |
| `odds_away` | float\|null | Bookmaker odds for away win |
| `model_agreement` | int\|null | How many models agree (1–3) |
| `result` | string | `"pending"` / `"win"` / `"loss"` / `"void"` |
| `model_version` | string | ML model version used |

---

### GET `/predictions/hero`
Best AI pick of the day (highest-confidence value bet).

**Query params:**
| Param | Type | Description |
|---|---|---|
| `from_date` | date | `YYYY-MM-DD` (default: today) |

**Response:** Single `PredictionResponse` object or `null`

---

### GET `/predictions/top`
Today's top picks (confidence ≥ 65).

**Response:** Array of up to 10 `PredictionResponse` objects

---

### GET `/predictions/{prediction_id}`
Single prediction by ID.

**Response:** Single `PredictionResponse`

---

### GET `/predictions/{prediction_id}/analysis`
Full match analysis — prediction + injuries + form + H2H.

**Response:**
```json
{
  "prediction": { /* PredictionResponse */ },
  "home_injuries": [
    {
      "name": "Romelu Lukaku",
      "position": "FW",
      "status": "injured",
      "detail": "Hamstring",
      "return_date": "2026-05-25",
      "photo_url": "https://...",
      "chance_of_playing": 0
    }
  ],
  "away_injuries": [ /* same structure */ ],
  "home_form": [
    {
      "date": "2026-05-10",
      "opponent": "AC Milan",
      "home_or_away": "H",
      "goals_for": 2,
      "goals_against": 0,
      "result": "W",
      "competition": "Serie A"
    }
  ],
  "away_form": [ /* same structure */ ],
  "head_to_head": [
    {
      "date": "2025-12-01",
      "home_team": "Inter Milan",
      "away_team": "Hellas Verona",
      "home_score": 3,
      "away_score": 0,
      "competition": "Serie A"
    }
  ],
  "home_goals_scored_avg": 2.14,
  "home_goals_conceded_avg": 0.72,
  "away_goals_scored_avg": 0.85,
  "away_goals_conceded_avg": 1.93,
  "home_form_string": "W W D W W",
  "away_form_string": "L D L W L",
  "venue": "Stadio Giuseppe Meazza",
  "referee": null
}
```

---

## Matches

### GET `/matches/`
List matches with filters.

**Query params:**
| Param | Type | Description |
|---|---|---|
| `date_from` | date | `YYYY-MM-DD` |
| `date_to` | date | `YYYY-MM-DD` |
| `league_id` | int | Filter by league |
| `status` | string | `"scheduled"` / `"live"` / `"finished"` |
| `limit` | int | Max 200, default 50 |
| `offset` | int | Pagination |

**Response: `200` — array of `MatchResponse`**
```json
[
  {
    "id": 36,
    "league": { /* LeagueResponse */ },
    "home_team": { /* TeamResponse */ },
    "away_team": { /* TeamResponse */ },
    "match_date": "2026-05-17T13:00:00Z",
    "status": "scheduled",
    "home_score": null,
    "away_score": null,
    "minute": null,
    "venue": "Stadio Giuseppe Meazza",
    "stats": null
  }
]
```

**`status` values:**
- `"scheduled"` — match not yet started
- `"live"` — match in progress
- `"finished"` — match completed

---

### GET `/matches/today`
All matches for today.

**Response:** Array of `MatchResponse`

---

### GET `/matches/live`
All currently live matches.

**Response:** Array of `MatchResponse` (includes `stats` field with live data)

---

### GET `/matches/{match_id}`
Single match by ID.

---

## Live (Real-time)

### GET `/live/matches`
Current live match state from ESPN polling cache (updates every 30s).

**Response:**
```json
{
  "live_matches": [
    {
      "id": "espn_737149",
      "league": "ITA.1",
      "home_team": "Pisa",
      "away_team": "Napoli",
      "home_score": 0,
      "away_score": 2,
      "minute": 50,
      "status": "live",
      "period": "2nd",
      "venue": "Arena Garibaldi"
    }
  ],
  "count": 5,
  "connected_clients": 2
}
```

---

### GET `/live/lineup/{league_slug}/{event_id}`
Starting lineups for a match (available ~45 min before kickoff).

**Example:** `GET /live/lineup/ITA.1/737149`

**Response:**
```json
{
  "home": {
    "team": "Inter Milan",
    "formation": "3-5-2",
    "starters": [
      {
        "name": "Lautaro Martinez",
        "position": "FW",
        "position_name": "Forward",
        "jersey": "10",
        "starter": true,
        "photo_url": "https://..."
      }
    ],
    "bench": [ /* same structure */ ]
  },
  "away": { /* same structure */ }
}
```

---

### WebSocket `/ws`
Real-time live match updates pushed from server.

**Connect:** `ws://your-backend-domain/ws`

**Messages received (JSON):**
```json
{
  "type": "live_update",
  "data": {
    "match_id": "espn_737149",
    "home_score": 1,
    "away_score": 0,
    "minute": 67,
    "status": "live"
  }
}
```

---

## Leagues

### GET `/leagues/`
List all active leagues.

**Query params:**
| Param | Type | Default | Description |
|---|---|---|---|
| `active_only` | bool | true | Only active leagues |

**Response:**
```json
[
  {
    "id": 17,
    "external_id": "ITA.1",
    "name": "Serie A",
    "country": "Italy",
    "logo_url": "https://...",
    "season": "2025-26",
    "tier": 1
  }
]
```

**Leagues available:**
| `external_id` | Name | Country |
|---|---|---|
| `ENG.1` | Premier League | England |
| `ESP.1` | La Liga | Spain |
| `GER.1` | Bundesliga | Germany |
| `ITA.1` | Serie A | Italy |
| `FRA.1` | Ligue 1 | France |
| `ENG.2` | Championship | England |
| `ESP.2` | Segunda División | Spain |

---

## Teams

### GET `/teams/`
List teams.

**Query params:** `league_id`, `limit` (max 200)

**Response:**
```json
[
  {
    "id": 120,
    "name": "Inter Milan",
    "short_name": "INT",
    "logo_url": "https://...",
    "country": "Italy",
    "elo_rating": 1870.0,
    "form_score": 0.0,
    "attack_strength": 1.72,
    "defense_weakness": 0.65
  }
]
```

---

### GET `/teams/{team_id}`
Single team.

### GET `/teams/{team_id}/players`
All players for a team.

### GET `/teams/{team_id}/injuries`
Only injured/suspended/doubtful players.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Romelu Lukaku",
    "position": "FW",
    "photo_url": "https://...",
    "is_injured": true,
    "is_suspended": false,
    "is_doubtful": false,
    "injury_detail": "Hamstring",
    "return_date": "2026-05-25T00:00:00Z",
    "importance_score": 8.5
  }
]
```

---

## Analytics

### GET `/analytics/overview`
Platform-wide accuracy and ROI stats.

**Response:**
```json
{
  "total_predictions": 1250,
  "settled_predictions": 430,
  "accuracy_rate": 0.612,
  "roi": 0.087,
  "value_bet_accuracy": 0.643,
  "avg_confidence": 54.3,
  "total_leagues": 7,
  "by_market": {
    "1X2": { "accuracy": 0.58, "count": 250 },
    "OVER_2.5": { "accuracy": 0.65, "count": 180 }
  }
}
```

---

### GET `/analytics/settled-predictions`
Past predictions with results.

**Query params:** `limit` (max 200), `offset`

**Response:**
```json
[
  {
    "prediction_id": 1,
    "match_id": 36,
    "home_team": "Inter Milan",
    "away_team": "Hellas Verona",
    "league": "Serie A",
    "match_date": "2026-05-17T13:00:00Z",
    "score": "2–0",
    "recommended_bet": "1",
    "result": "win",
    "is_correct": true,
    "odds": 1.45,
    "profit_loss": 0.45,
    "confidence_score": 58.0,
    "value_bet": true
  }
]
```

---

## Backtest

### GET `/backtest/run`
Run historical backtest simulation.

**Query params:**
| Param | Type | Description |
|---|---|---|
| `league_id` | int | Filter by league |
| `from_date` | date | Start date |
| `to_date` | date | End date |
| `min_confidence` | float | Min confidence threshold |

**Response:**
```json
{
  "total_predictions": 200,
  "correct_predictions": 122,
  "accuracy": 0.61,
  "roi": 0.092,
  "total_profit_loss": 18.4,
  "avg_confidence": 56.2,
  "by_league": {
    "Serie A": { "accuracy": 0.64, "roi": 0.11, "count": 48 }
  },
  "by_market": {
    "1": { "accuracy": 0.60, "roi": 0.08, "count": 120 },
    "OVER_2.5": { "accuracy": 0.66, "roi": 0.13, "count": 50 }
  },
  "by_confidence_tier": {
    "50-60": { "accuracy": 0.55, "count": 80 },
    "60-70": { "accuracy": 0.63, "count": 60 },
    "70+": { "accuracy": 0.72, "count": 20 }
  },
  "monthly_performance": [
    { "month": "2026-04", "accuracy": 0.59, "roi": 0.07, "count": 35 }
  ]
}
```

---

## Subscriptions

### GET `/subscriptions/plans`
Available subscription plans and features.

### POST `/subscriptions/subscribe`
Subscribe to a plan.
**Headers:** `Authorization: Bearer <token>`

---

## Health

### GET `/health`
Backend health check. No auth required.

**Response:**
```json
{ "status": "ok", "version": "1.0.0" }
```

---

## Common Enums

### Match Status
| Value | Meaning |
|---|---|
| `scheduled` | Not started |
| `live` | In progress |
| `finished` | Completed |

### Recommended Bet
| Value | Meaning |
|---|---|
| `1` | Home win |
| `X` | Draw |
| `2` | Away win |
| `OVER_2.5` | Over 2.5 goals |
| `BTTS` | Both teams to score |

### Risk Category
| Value | When |
|---|---|
| `Safe` | Confidence ≥ 62, risk < 45, 3 models agree |
| `Balanced` | Confidence ≥ 50, risk < 55 |
| `Aggressive` | Lower confidence, potential value |
| `High Variance` | Risk ≥ 60 or very close probabilities |

### Prediction Result
| Value | Meaning |
|---|---|
| `pending` | Match not yet played |
| `win` | Recommended bet won |
| `loss` | Recommended bet lost |
| `void` | Match cancelled/postponed |

---

## Error Responses

All errors follow this format:
```json
{
  "detail": "Error message here"
}
```

| Status | Meaning |
|---|---|
| `400` | Bad request / validation error |
| `401` | Not authenticated |
| `403` | Insufficient permissions (premium required) |
| `404` | Resource not found |
| `409` | Conflict (e.g. email already registered) |
| `429` | Rate limit exceeded |
