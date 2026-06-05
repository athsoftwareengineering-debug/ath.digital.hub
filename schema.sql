-- ============================================================
-- ATH DIGITAL HUB - DATABASE SCHEMA
-- Supabase SQL Editor တွင် Run ရန်
-- ============================================================

-- ============================================================
-- 1. ORDERS TABLE (အော်ဒါများ သိမ်းဆည်းရန်)
-- ============================================================
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
    payment_method TEXT DEFAULT 'kpay',
    activated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 2. USER STATS TABLE (အသုံးပြုသူ စာရင်းအင်း)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_stats (
    phone TEXT PRIMARY KEY,
    order_count INTEGER DEFAULT 0,
    reject_count INTEGER DEFAULT 0,
    suspect_flag BOOLEAN DEFAULT FALSE,
    blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 3. MARKET PRODUCTS TABLE (ထုတ်ကုန်များ)
-- ============================================================
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

-- ============================================================
-- INDEXES (အမြန်ရှာဖွေရန်)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_image_hash ON orders(image_hash);
CREATE INDEX IF NOT EXISTS idx_user_stats_phone ON user_stats(phone);
CREATE INDEX IF NOT EXISTS idx_user_stats_blocked ON user_stats(blocked);
CREATE INDEX IF NOT EXISTS idx_market_products_category ON market_products(category);

-- ============================================================
-- SAMPLE PRODUCTS (နမူနာ ထုတ်ကုန်များ)
-- ============================================================
INSERT INTO market_products (name, price, category, icon, discount) VALUES
('Premium T-Shirt', 25000, 'Men', 'fas fa-tshirt', 20),
('Casual Bag', 35000, 'Accessories', 'fas fa-shopping-bag', 15),
('Sports Shoes', 45000, 'Men', 'fas fa-shoe-prints', 10),
('Formal Shirt', 55000, 'Men', 'fas fa-user-tie', 0),
('Summer Dress', 49000, 'Women', 'fas fa-female', 0),
('Leather Bag', 39000, 'Women', 'fas fa-bag-shopping', 0),
('Winter Jacket', 89000, 'Men', 'fas fa-vest', 25),
('Silk Scarf', 12000, 'Women', 'fas fa-hand-peace', 0)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- VERIFY TABLES (စစ်ဆေးရန်)
-- ============================================================
SELECT '✅ Orders table:' as status, COUNT(*) as count FROM orders
UNION ALL
SELECT '✅ User Stats table:' as status, COUNT(*) FROM user_stats
UNION ALL
SELECT '✅ Market Products table:' as status, COUNT(*) FROM market_products;

-- ============================================================
-- OPTIONAL: DROP TABLES (ပြန်လည်စတင်လိုပါက သုံးရန်)
-- ============================================================
-- DROP TABLE IF EXISTS orders;
-- DROP TABLE IF EXISTS user_stats;
-- DROP TABLE IF EXISTS market_products;
