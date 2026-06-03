// database.js - Supabase Client
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Anon client (for public operations)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client (with service role for admin operations)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Function to ensure user_stats table exists (run once)
async function initUserStatsTable() {
    // Note: In Supabase, you need to create this table manually via SQL editor
    // Run this SQL in Supabase SQL Editor:
    /*
    CREATE TABLE IF NOT EXISTS user_stats (
        id SERIAL PRIMARY KEY,
        phone TEXT UNIQUE NOT NULL,
        order_count INTEGER DEFAULT 0,
        reject_count INTEGER DEFAULT 0,
        suspect_flag BOOLEAN DEFAULT FALSE,
        blocked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    );
    */
    console.log("✅ Ensure user_stats table exists in Supabase");
}

module.exports = { supabase, supabaseAdmin, initUserStatsTable };