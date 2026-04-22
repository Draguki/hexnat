-- ═══════════════════════════════════════════════════════════════════════════
-- HexNeedle Analytics — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- Needed for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────
-- TABLE: sessions
-- One row per browser session. Created/upserted by the API on every event.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT        PRIMARY KEY,
  site_id       TEXT        NOT NULL DEFAULT 'hexneedle',
  first_seen    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen     TIMESTAMPTZ NOT NULL DEFAULT now(),
  utm_source    TEXT,
  utm_medium    TEXT,
  utm_campaign  TEXT,
  referrer      TEXT,
  locale        TEXT,
  screen_w      INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_site      ON sessions (site_id);
CREATE INDEX IF NOT EXISTS idx_sessions_first     ON sessions (first_seen DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_utm       ON sessions (utm_source) WHERE utm_source IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- TABLE: events
-- Every tracked event. Type-specific data stored in JSONB `props`.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id            BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id    TEXT        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  site_id       TEXT        NOT NULL DEFAULT 'hexneedle',
  type          TEXT        NOT NULL,
  url           TEXT,
  path          TEXT,
  title         TEXT,
  ts            TIMESTAMPTZ NOT NULL,
  screen_w      INTEGER,
  session_age   INTEGER,
  locale        TEXT,
  utm_source    TEXT,
  utm_medium    TEXT,
  utm_campaign  TEXT,
  referrer      TEXT,
  props         JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Core query indexes
CREATE INDEX IF NOT EXISTS idx_events_type        ON events (type);
CREATE INDEX IF NOT EXISTS idx_events_session     ON events (session_id);
CREATE INDEX IF NOT EXISTS idx_events_ts          ON events (ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_site_ts     ON events (site_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_path        ON events (path) WHERE path IS NOT NULL;
-- GIN index allows queries like: props->>'product_name' = 'Black Suit'
CREATE INDEX IF NOT EXISTS idx_events_props       ON events USING GIN (props);

-- ─────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- The API uses the service_role key and BYPASSES RLS automatically.
-- The dashboard uses the anon key — these policies allow it to read.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events   ENABLE ROW LEVEL SECURITY;

-- Allow read from dashboard (anon key)
CREATE POLICY "allow_anon_read_sessions"
  ON sessions FOR SELECT
  USING (true);  -- tighten to: site_id = 'hexneedle'

CREATE POLICY "allow_anon_read_events"
  ON events FOR SELECT
  USING (true);  -- tighten to: site_id = 'hexneedle'

-- Block direct inserts from anon key (writes go through the API with service key)
CREATE POLICY "block_anon_insert_sessions"
  ON sessions FOR INSERT
  WITH CHECK (false);

CREATE POLICY "block_anon_insert_events"
  ON events FOR INSERT
  WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────
-- CLEANUP JOB (optional — requires pg_cron extension)
-- Enable: Dashboard → Database → Extensions → pg_cron → Enable
-- Then run the SELECT below once to register the cron job.
-- ─────────────────────────────────────────────────────────────────────────

-- SELECT cron.schedule(
--   'cleanup-old-events',
--   '0 3 * * 0',   -- Every Sunday at 3am UTC
--   $$DELETE FROM events WHERE ts < NOW() - INTERVAL '90 days'$$
-- );
