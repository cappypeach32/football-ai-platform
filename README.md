# Football AI Platform

A premium, enterprise-grade **AI Football Analytics & Match Prediction Platform** — built like a real SaaS product.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, TailwindCSS, Framer Motion, Recharts, Zustand, TanStack Query |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2 (async), Alembic, WebSockets |
| AI Engine | Poisson model (Dixon-Coles), XGBoost ensemble, ELO adjustment |
| Database | PostgreSQL 16 |
| Cache / Queue | Redis 7, Celery |
| Infra | Docker Compose, Nginx |

---

## Project Structure

```
football-ai-platform/
├── backend/                  # FastAPI backend
│   ├── app/
│   │   ├── ai/               # AI prediction engine
│   │   │   └── engine.py     # Poisson + ELO + narrative generator
│   │   ├── core/             # Security, middleware
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── routers/          # API route handlers
│   │   ├── schemas/          # Pydantic schemas
│   │   ├── services/         # Business logic (analytics, backtest)
│   │   ├── tasks/            # Celery background tasks
│   │   ├── websockets/       # WebSocket manager + handlers
│   │   ├── config.py         # Settings (pydantic-settings)
│   │   ├── database.py       # Async SQLAlchemy engine
│   │   ├── dependencies.py   # FastAPI dependency injection
│   │   └── main.py           # App factory
│   ├── alembic/              # Database migrations
│   ├── alembic.ini
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/                 # Next.js 14 frontend
│   ├── src/
│   │   ├── app/              # Next.js App Router pages
│   │   │   ├── page.tsx           # Dashboard
│   │   │   ├── predictions/       # Prediction browser
│   │   │   ├── live/              # Live match tracker
│   │   │   ├── analytics/         # Advanced analytics
│   │   │   └── backtest/          # Backtest engine
│   │   ├── components/
│   │   │   ├── analytics/         # Charts, radar, league stats
│   │   │   ├── backtest/          # Summary cards, history table
│   │   │   ├── dashboard/         # Stats bar, alerts, sidebar
│   │   │   ├── layout/            # Sidebar, TopBar
│   │   │   ├── live/              # Live match cards
│   │   │   ├── predictions/       # Prediction cards, filters
│   │   │   └── ui/                # Skeleton, shared UI
│   │   ├── hooks/            # useLiveMatch (WebSocket)
│   │   ├── lib/              # api.ts (Axios), utils
│   │   ├── stores/           # Zustand stores
│   │   └── types/            # TypeScript interfaces
│   ├── tailwind.config.ts    # Design system tokens
│   ├── Dockerfile
│   └── package.json
│
├── nginx/                    # Reverse proxy
├── database/                 # Init SQL seed
├── docker-compose.yml
├── .env.example
└── Makefile
```

---

## Quick Start

### 1. Clone & configure

```bash
git clone <repo-url> football-ai-platform
cd football-ai-platform
cp .env.example .env
# Edit .env with your secrets
```

### 2. Start with Docker Compose

```bash
make dev
# or manually:
docker-compose up -d
```

### 3. Run migrations

```bash
make migrate
# or:
docker-compose exec backend alembic upgrade head
```

### 4. Access

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000/api/v1 |
| API Docs | http://localhost:8000/api/docs |
| Flower (Celery) | http://localhost:5555 |

---

## Local Development (without Docker)

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

---

## API Overview

| Endpoint | Description |
|---|---|
| `POST /api/v1/auth/register` | Register |
| `POST /api/v1/auth/login` | Login → JWT |
| `GET /api/v1/predictions/top` | Today's top AI picks |
| `GET /api/v1/predictions/` | All predictions (filterable) |
| `POST /api/v1/predictions/generate/{match_id}` | Trigger AI prediction (Premium) |
| `GET /api/v1/matches/live` | Live matches |
| `GET /api/v1/analytics/overview` | Platform stats |
| `GET /api/v1/analytics/team/{id}/radar` | Team radar data |
| `GET /api/v1/backtest/summary` | Backtest ROI/accuracy |
| `WS /ws/live/{match_id}` | Live match WebSocket feed |

---

## AI Engine

The prediction engine (`backend/app/ai/engine.py`) uses:

1. **Dixon-Coles Poisson Model** — bivariate Poisson distribution with low-score correction for accurate score matrix
2. **ELO Adjustment** — adjusts win probabilities based on team ELO rating differential
3. **Confidence Scoring** — entropy-based confidence from 30–98%, boosted by ELO gap and form differential
4. **Value Bet Detection** — compares AI probability vs market implied odds (5% edge threshold)
5. **AI Narrative Generator** — human-readable tactical summary, key factors, and match insights

---

## Design System

| Token | Value |
|---|---|
| Background | `#0D1117` |
| Surface | `#1C2128` |
| Border | `#30363D` |
| Neon Green | `#00FF87` |
| Neon Blue | `#00D4FF` |
| Neon Purple | `#8B5CF6` |
| Typography | Inter + JetBrains Mono |

All UI components follow **glassmorphism + dark dashboard** aesthetic with smooth Framer Motion animations.

---

## Subscription Plans

| Plan | Price | Features |
|---|---|---|
| Free | $0 | 5 predictions/day, basic stats |
| Premium | $9.99/mo | Unlimited predictions, AI insights, backtesting, live analytics |
| VIP | $24.99/mo | Everything + API access, custom alerts, priority support |

---

## Security

- JWT access tokens (30min) + refresh tokens (7 days)
- Bcrypt password hashing
- Role-based access control (user / moderator / admin)
- CORS configured per environment
- Security headers middleware (X-Frame-Options, X-XSS-Protection, etc.)
- SQL injection prevention via SQLAlchemy ORM
- Input validation via Pydantic

---

## Deployment

Production Docker Compose (`docker-compose.prod.yml`) adds:
- Nginx with SSL termination
- Non-debug API docs disabled
- Gunicorn workers instead of uvicorn dev mode
- Static file serving optimization

```bash
docker-compose -f docker-compose.prod.yml up -d
```
