-- ============================================================
-- ATH DIGITAL HUB - DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================================

-- Drop existing tables if needed (BE CAREFUL!)
-- DROP TABLE IF EXISTS orders;
-- DROP TABLE IF EXISTS user_stats;

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id BIGINT PRIMARY KEY,
    phone TEXT NOT NULL,
    plan TEXT NOT NULL,
    price INT NOT NULL,
    status TEXT DEFAULT 'Pending',
    slip_url TEXT,
    image_hash TEXT,
    activated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create user_stats table
CREATE TABLE IF NOT EXISTS user_stats (
    phone TEXT PRIMARY KEY,
    order_count INTEGER DEFAULT 0,
    reject_count INTEGER DEFAULT 0,
    suspect_flag BOOLEAN DEFAULT FALSE,
    blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_image_hash ON orders(image_hash);
CREATE INDEX IF NOT EXISTS idx_user_stats_blocked ON user_stats(blocked);

-- Verify tables
SELECT COUNT(*) as orders_count FROM orders;
SELECT COUNT(*) as users_count FROM user_stats;
