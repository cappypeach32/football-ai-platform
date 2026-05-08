-- Football AI Platform - Initial Schema
-- Managed via Alembic; this file seeds initial reference data

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Indexes for full-text search on team/league names
-- These are created by Alembic; this seed inserts reference leagues

INSERT INTO leagues (name, country, logo_url, season, is_active, tier) VALUES
  ('Premier League',    'England',    NULL, '2024/25', TRUE, 1),
  ('Championship',      'England',    NULL, '2024/25', TRUE, 2),
  ('League One',        'England',    NULL, '2024/25', TRUE, 3),
  ('La Liga',           'Spain',      NULL, '2024/25', TRUE, 1),
  ('Bundesliga',        'Germany',    NULL, '2024/25', TRUE, 1),
  ('Serie A',           'Italy',      NULL, '2024/25', TRUE, 1),
  ('Ligue 1',           'France',     NULL, '2024/25', TRUE, 1),
  ('Eredivisie',        'Netherlands',NULL, '2024/25', TRUE, 1),
  ('Primeira Liga',     'Portugal',   NULL, '2024/25', TRUE, 1),
  ('Scottish Prem',     'Scotland',   NULL, '2024/25', TRUE, 1)
ON CONFLICT DO NOTHING;
