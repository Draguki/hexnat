-- HexNeedle Analytics FINAL STABLE Migration v3.2.1
-- Safe to run multiple times. Will NOT delete any existing data.
-- Run in: Supabase Dashboard -> SQL Editor -> New Query -> Run

-- ORDERS TABLE
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_city TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_state TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_zip TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS check_payment BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS check_processing BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS check_ready BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS check_shipped BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- SESSIONS TABLE
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT UNIQUE NOT NULL,
    site_id TEXT,
    first_seen TIMESTAMPTZ DEFAULT now(),
    last_seen TIMESTAMPTZ DEFAULT now(),
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    referrer TEXT,
    entry_path TEXT,
    user_agent TEXT,
    ip_address TEXT
);

-- EVENTS TABLE
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    session_id TEXT,
    site_id TEXT,
    type TEXT,
    path TEXT,
    title TEXT,
    url TEXT,
    ts TIMESTAMPTZ,
    props JSONB
);

-- CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    email TEXT UNIQUE,
    phone TEXT,
    name TEXT,
    city TEXT,
    state TEXT,
    fbc TEXT,
    fbp TEXT,
    fbclid TEXT
);

-- CUSTOMER TIMELINE TABLE
CREATE TABLE IF NOT EXISTS customer_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    customer_id UUID REFERENCES customers(id),
    event_type TEXT,
    event_label TEXT,
    path TEXT,
    ts TIMESTAMPTZ,
    props JSONB
);

-- CAPI EVENTS SENT TABLE (audit log)
CREATE TABLE IF NOT EXISTS capi_events_sent (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sent_at TIMESTAMPTZ DEFAULT now(),
    event_name TEXT,
    event_id TEXT UNIQUE,
    payload JSONB,
    meta_response JSONB,
    http_status INTEGER,
    error_msg TEXT
);

-- REFRESH SCHEMA CACHE (CRITICAL - run this last)
NOTIFY pgrst, 'reload schema';
