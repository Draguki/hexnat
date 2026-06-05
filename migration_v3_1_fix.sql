-- ─────────────────────────────────────────────────────────────────────────
-- V3.1 SCHEMA FIX & ENHANCEMENT
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Add missing columns to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS screen_w INTEGER;
ALTER TABLE events ADD COLUMN IF NOT EXISTS session_age INTEGER;
ALTER TABLE events ADD COLUMN IF NOT EXISTS locale TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS referrer TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS data_version TEXT DEFAULT 'V3.1';

-- 2. Add missing columns to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS data_version TEXT DEFAULT 'V3.1';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS screen_w INTEGER;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS locale TEXT;

-- 3. Ensure active_carts table exists (from 3.1 migration)
CREATE TABLE IF NOT EXISTS active_carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id TEXT NOT NULL DEFAULT 'hexneedle',
    session_id TEXT NOT NULL UNIQUE, 
    customer_id TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    total_items INTEGER DEFAULT 0,
    total_revenue NUMERIC(10, 2) DEFAULT 0,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    utm_term TEXT,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_type_ts ON events(type, ts);
CREATE INDEX IF NOT EXISTS idx_active_carts_updated ON active_carts(last_updated);
