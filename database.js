// database.js - Supabase Client Setup
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    console.error("❌ Crucial error: Supabase environment variables are missing!");
}

// Anon client (for public operations)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client (with service role for admin operations)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

module.exports = { supabase, supabaseAdmin };
