-- HexNeedle Analytics FINAL STABLE Migration v3.2.1
-- Ensures all columns exist for the stabilized dashboard and tracking
-- Run this in: Supabase Dashboard -> SQL Editor -> New Query -> Run

-- 1. ORDERS TABLE UPDATES
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

-- 2. CUSTOMERS TABLE UPDATES
ALTER TABLE customers ADD COLUMN IF NOT EXISTS fbclid TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS fbc TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS fbp TEXT;

-- 3. ANALYTICS TABLES (Ensuring they exist for tracking)
CREATE TABLE IF NOT EXISTS customer_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id),
    event_type TEXT,
    event_label TEXT,
    path TEXT,
    ts TIMESTAMPTZ,
    props JSONB
);

CREATE TABLE IF NOT EXISTS capi_events_sent (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sent_at TIMESTAMPTZ DEFAULT now(),
    event_name TEXT,
    event_id TEXT,
    payload JSONB,
    meta_response JSONB,
    http_status INTEGER
);

-- 4. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
