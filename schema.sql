-- ============================================================
-- ATH DIGITAL HUB - DATABASE SCHEMA (COMPLETE)
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
    payment_method TEXT DEFAULT 'kpay' CHECK (payment_method IN ('kpay', 'wavepay', 'ayapay')),
    activated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 2. USER STATS TABLE (အသုံးပြုသူ စာရင်းအင်း - with User ID)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_stats (
    id SERIAL PRIMARY KEY,
    phone TEXT UNIQUE NOT NULL,
    username TEXT,
    user_id TEXT UNIQUE NOT NULL,
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
-- 4. PAYMENT METHODS TABLE (ငွေပေးချေမှုနည်းလမ်းများ)
-- ============================================================
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

-- ============================================================
-- 5. ADMIN NOTIFICATIONS TABLE (Database Notifications)
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_notifications (
    id SERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- ============================================================
-- INDEXES (အမြန်ရှာဖွေရန်)
-- ============================================================
-- Orders table indexes
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);
CREATE INDEX IF NOT EXISTS idx_orders_image_hash ON orders(image_hash);

-- User stats table indexes
CREATE INDEX IF NOT EXISTS idx_user_stats_phone ON user_stats(phone);
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_username ON user_stats(username);
CREATE INDEX IF NOT EXISTS idx_user_stats_blocked ON user_stats(blocked);
CREATE INDEX IF NOT EXISTS idx_user_stats_created_at ON user_stats(created_at);

-- Market products table indexes
CREATE INDEX IF NOT EXISTS idx_market_products_category ON market_products(category);

-- Admin notifications table indexes
CREATE INDEX IF NOT EXISTS idx_admin_notifications_order_id ON admin_notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_is_read ON admin_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at);

-- ============================================================
-- AUTO-INCREMENT FUNCTION FOR USER_ID
-- ============================================================
CREATE OR REPLACE FUNCTION generate_user_id()
RETURNS TRIGGER AS $$
DECLARE
    next_num INTEGER;
    last_id TEXT;
BEGIN
    SELECT user_id INTO last_id FROM user_stats ORDER BY id DESC LIMIT 1;
    IF last_id IS NULL THEN
        next_num := 10001;
    ELSE
        next_num := CAST(SUBSTRING(last_id FROM 'ATH-([0-9]+)') AS INTEGER) + 1;
    END IF;
    NEW.user_id := 'ATH-' || next_num::TEXT;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_user_id ON user_stats;
CREATE TRIGGER trigger_generate_user_id
    BEFORE INSERT ON user_stats
    FOR EACH ROW
    WHEN (NEW.user_id IS NULL)
    EXECUTE FUNCTION generate_user_id();

-- ============================================================
-- INSERT PAYMENT METHODS
-- ============================================================
INSERT INTO payment_methods (name, account_name, account_number, display_order) VALUES
('KBZ Pay', 'AUNG THU HTWE', '09789999368', 1),
('WavePay', 'AUNG THU HTWE', '09789999368', 2),
('AYA Pay', 'AUNG THU HTWE', '09789999368', 3)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- INSERT SAMPLE PRODUCTS
-- ============================================================
INSERT INTO market_products (name, price, category, icon, discount) VALUES
('Premium T-Shirt', 25000, 'Men', 'fas fa-tshirt', 20),
('Casual Bag', 35000, 'Accessories', 'fas fa-shopping-bag', 15),
('Sports Shoes', 45000, 'Men', 'fas fa-shoe-prints', 10),
('Formal Shirt', 55000, 'Men', 'fas fa-user-tie', 0),
('Summer Dress', 49000, 'Women', 'fas fa-female', 0),
('Leather Bag', 39000, 'Women', 'fas fa-bag-shopping', 0)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- INSERT SAMPLE USER (Optional - for testing)
-- ============================================================
INSERT INTO user_stats (phone, username, order_count, reject_count) VALUES
('09789999368', 'Admin User', 0, 0)
ON CONFLICT (phone) DO NOTHING;

-- ============================================================
-- VERIFY TABLES (စစ်ဆေးရန်)
-- ============================================================
SELECT '✅ Orders table' as status, COUNT(*) as count FROM orders
UNION ALL
SELECT '✅ User Stats table', COUNT(*) FROM user_stats
UNION ALL
SELECT '✅ Market Products table', COUNT(*) FROM market_products
UNION ALL
SELECT '✅ Payment Methods table', COUNT(*) FROM payment_methods
UNION ALL
SELECT '✅ Admin Notifications table', COUNT(*) FROM admin_notifications;

-- ============================================================
-- SHOW USER ID FORMAT EXAMPLE
-- ============================================================
SELECT '📌 User ID Format: ATH-10001, ATH-10002, ...' as info;

-- ============================================================
-- OPTIONAL: DROP TABLES (ပြန်လည်စတင်လိုပါက သုံးရန်)
-- ============================================================
-- DROP TABLE IF EXISTS admin_notifications;
-- DROP TABLE IF EXISTS orders;
-- DROP TABLE IF EXISTS user_stats;
-- DROP TABLE IF EXISTS market_products;
-- DROP TABLE IF EXISTS payment_methods;
-- DROP FUNCTION IF EXISTS generate_user_id();
