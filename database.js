// ============================================================
// ATH DIGITAL HUB - DATABASE CONFIGURATION
// ============================================================

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Environment check
if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ ERROR: Missing Supabase URL or Anon Key!');
    console.error('Please check your .env file');
    process.exit(1);
}

if (!supabaseServiceKey) {
    console.warn('⚠️ WARNING: Service key missing. Admin operations will fail!');
}

// Anon client (for public operations)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client (with service role for admin operations)
const supabaseAdmin = supabaseServiceKey 
    ? createClient(supabaseUrl, supabaseServiceKey)
    : supabase;

// SQL to run in Supabase SQL Editor
const INIT_SQL = `
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
`;

async function initUserStatsTable() {
    console.log("📋 Please run this SQL in Supabase SQL Editor:");
    console.log(INIT_SQL);
    console.log("✅ Make sure orders table already exists!");
    console.log("📱 Phone number format: 09XXXXXXXXX (Myanmar format)");
}

module.exports = { supabase, supabaseAdmin, initUserStatsTable };
