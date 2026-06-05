-- ─────────────────────────────────────────────────────────────────────────
-- V3.1 COMPREHENSIVE SYSTEM MIGRATION
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Create the active_carts table (for Live Add-to-Carts)
CREATE TABLE IF NOT EXISTS active_carts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id TEXT NOT NULL DEFAULT 'hexneedle',
    session_id TEXT NOT NULL UNIQUE, 
    customer_id TEXT REFERENCES customers(id),
    items JSONB DEFAULT '[]'::jsonb, -- Store full item specs here
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

-- 2. Create the orders table with 4 checkpoints and full PII
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number TEXT UNIQUE NOT NULL,
    customer_id TEXT REFERENCES customers(id),
    
    -- Full Customer PII Snapshot
    customer_email TEXT,
    customer_phone TEXT,
    customer_name TEXT,
    customer_address TEXT,
    customer_city TEXT,
    customer_state TEXT,
    customer_zip TEXT,
    
    -- Order Details
    items JSONB DEFAULT '[]'::jsonb, -- Store all customizations/measurements
    revenue NUMERIC(10, 2) DEFAULT 0,
    currency TEXT DEFAULT 'INR',
    
    -- 4 Checkpoints
    check_payment BOOLEAN DEFAULT FALSE,      -- Payment Done / Thank You Sent
    check_processing BOOLEAN DEFAULT FALSE,   -- Processing / Order Being Made
    check_ready BOOLEAN DEFAULT FALSE,        -- Video/Photo Ready
    check_shipped BOOLEAN DEFAULT FALSE,      -- Shipping ID Sent
    
    -- Attribution
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    utm_term TEXT,
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexing
CREATE INDEX IF NOT EXISTS idx_active_carts_session ON active_carts(session_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);

-- 4. Enable RLS
ALTER TABLE active_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 5. Policies
DROP POLICY IF EXISTS "Allow service role full access to active_carts" ON active_carts;
CREATE POLICY "Allow service role full access to active_carts" ON active_carts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role full access to orders" ON orders;
CREATE POLICY "Allow service role full access to orders" ON orders FOR ALL USING (true) WITH CHECK (true);
