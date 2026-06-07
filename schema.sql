-- ============================================================
-- ATH DIGITAL HUB - DATABASE SCHEMA (COMPLETE - FIXED)
-- ============================================================

-- 1. ORDERS TABLE
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

-- 2. USER STATS TABLE
CREATE TABLE IF NOT EXISTS user_stats (
    id SERIAL PRIMARY KEY,
    phone TEXT UNIQUE NOT NULL,
    username TEXT,
    user_id TEXT UNIQUE,
    order_count INTEGER DEFAULT 0,
    reject_count INTEGER DEFAULT 0,
    suspect_flag BOOLEAN DEFAULT FALSE,
    blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. MARKET PRODUCTS TABLE
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

-- 4. PAYMENT METHODS TABLE
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

-- 5. ADMIN NOTIFICATIONS TABLE (FIXED - No foreign key constraint)
CREATE TABLE IF NOT EXISTS admin_notifications (
    id SERIAL PRIMARY KEY,
    order_id BIGINT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error', 'new_order')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_user_stats_phone ON user_stats(phone);
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_order_id ON admin_notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_is_read ON admin_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at);

-- AUTO-INCREMENT FUNCTION FOR USER_ID
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

-- INSERT DEFAULT DATA
INSERT INTO payment_methods (name, account_name, account_number, display_order) VALUES
('KBZ Pay', 'AUNG THU HTWE', '09789999368', 1),
('WavePay', 'AUNG THU HTWE', '09789999368', 2),
('AYA Pay', 'AUNG THU HTWE', '09789999368', 3)
ON CONFLICT (name) DO NOTHING;

INSERT INTO market_products (name, price, category, icon, discount) VALUES
('Premium T-Shirt', 25000, 'Men', 'fas fa-tshirt', 20),
('Casual Bag', 35000, 'Accessories', 'fas fa-shopping-bag', 15),
('Sports Shoes', 45000, 'Men', 'fas fa-shoe-prints', 10)
ON CONFLICT (id) DO NOTHING;

-- AUTO NOTIFICATION TRIGGERS
CREATE OR REPLACE FUNCTION notify_new_order()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO admin_notifications (order_id, title, message, type)
    VALUES (NEW.id, '🆕 New Order', 'Order #' || NEW.id || ' from ' || NEW.phone, 'new_order');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_new_order ON orders;
CREATE TRIGGER trigger_notify_new_order
    AFTER INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_order();

-- VERIFY
SELECT '✅ Database schema fixed successfully!' as status;