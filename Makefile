.PHONY: help dev build stop clean migrate seed

help:
	@echo "Football AI Platform - Available Commands"
	@echo "========================================="
	@echo "make dev        - Start all services in development mode"
	@echo "make build      - Build all Docker images"
	@echo "make stop       - Stop all services"
	@echo "make clean      - Stop and remove all containers, volumes"
	@echo "make migrate    - Run database migrations"
	@echo "make seed       - Seed database with sample data"
	@echo "make test       - Run backend tests"
	@echo "make lint       - Lint backend code"
	@echo "make logs       - Follow all service logs"

dev:
	cp -n .env.example .env 2>/dev/null || true
	docker-compose up -d postgres redis
	@echo "Waiting for database..."
	@sleep 3
	docker-compose up backend celery_worker celery_beat frontend

build:
	docker-compose build

stop:
	docker-compose stop

clean:
	docker-compose down -v --remove-orphans

migrate:
	docker-compose exec backend alembic upgrade head

seed:
	docker-compose exec backend python -m app.scripts.seed

test:
	docker-compose exec backend pytest tests/ -v

lint:
	docker-compose exec backend ruff check app/
	docker-compose exec backend mypy app/

logs:
	docker-compose logs -f

backend-shell:
	docker-compose exec backend bash

frontend-shell:
	docker-compose exec frontend sh

db-shell:
	docker-compose exec postgres psql -U fai_user -d football_ai

# Local development (without Docker)
local-backend:
	cd backend && uvicorn app.main:app --reload --port 8000

local-frontend:
	cd frontend && npm run dev

local-install:
	cd backend && pip install -r requirements.txt
	cd frontend && npm install
