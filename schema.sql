-- ============================================================
-- ATH DIGITAL HUB - DATABASE SCHEMA (Updated with AYA Pay)
-- ============================================================

-- Orders table (updated payment_method to include ayapay)
CREATE TABLE IF NOT EXISTS orders (
    id BIGINT PRIMARY KEY,
    phone TEXT NOT NULL,
    plan TEXT NOT NULL,
    price INT NOT NULL,
    status TEXT DEFAULT 'Pending',
    slip_url TEXT,
    image_hash TEXT,
    sender_name TEXT,
    last5_digits TEXT,
    payment_method TEXT DEFAULT 'kpay' CHECK (payment_method IN ('kpay', 'wavepay', 'ayapay')),
    activated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- User stats table
CREATE TABLE IF NOT EXISTS user_stats (
    phone TEXT PRIMARY KEY,
    order_count INTEGER DEFAULT 0,
    reject_count INTEGER DEFAULT 0,
    suspect_flag BOOLEAN DEFAULT FALSE,
    blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Market products table
CREATE TABLE IF NOT EXISTS market_products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    price INT NOT NULL,
    image TEXT,
    category TEXT DEFAULT 'Uncategorized',
    icon TEXT DEFAULT 'fas fa-box',
    discount INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Payment methods table (new)
CREATE TABLE IF NOT EXISTS payment_methods (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    account_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    qr_code TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Live sessions table (for tracking live viewers)
CREATE TABLE IF NOT EXISTS live_sessions (
    id SERIAL PRIMARY KEY,
    session_id TEXT UNIQUE,
    ip_address TEXT,
    user_agent TEXT,
    connected_at TIMESTAMP DEFAULT NOW(),
    last_heartbeat TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);
CREATE INDEX IF NOT EXISTS idx_user_stats_phone ON user_stats(phone);
CREATE INDEX IF NOT EXISTS idx_user_stats_blocked ON user_stats(blocked);
CREATE INDEX IF NOT EXISTS idx_live_sessions_last_heartbeat ON live_sessions(last_heartbeat);

-- Insert payment methods
INSERT INTO payment_methods (name, account_name, account_number, display_order) VALUES
('KBZ Pay', 'AUNG THU HTWE', '09789999368', 1),
('WavePay', 'AUNG THU HTWE', '09789999368', 2),
('AYA Pay', 'AUNG THU HTWE', '09789999368', 3)
ON CONFLICT (name) DO NOTHING;

-- Insert sample products
INSERT INTO market_products (name, price, category, icon, discount) VALUES
('Premium T-Shirt', 25000, 'Men', 'fas fa-tshirt', 20),
('Casual Bag', 35000, 'Accessories', 'fas fa-shopping-bag', 15),
('Sports Shoes', 45000, 'Men', 'fas fa-shoe-prints', 10),
('Formal Shirt', 55000, 'Men', 'fas fa-user-tie', 0),
('Summer Dress', 49000, 'Women', 'fas fa-female', 0),
('Leather Bag', 39000, 'Women', 'fas fa-bag-shopping', 0)
ON CONFLICT DO NOTHING;

-- Verify
SELECT '✅ Orders table' as status, COUNT(*) FROM orders
UNION ALL
SELECT '✅ User Stats table', COUNT(*) FROM user_stats
UNION ALL
SELECT '✅ Market Products table', COUNT(*) FROM market_products
UNION ALL
SELECT '✅ Payment Methods table', COUNT(*) FROM payment_methods;
