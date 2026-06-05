const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables!');
    console.error('Please check your .env file has:');
    console.error('  SUPABASE_URL');
    console.error('  SUPABASE_ANON_KEY');
    console.error('  SUPABASE_SERVICE_KEY');
    process.exit(1);
}

// Anon client (for public operations like creating orders)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client (with service role for admin operations like approving/rejecting)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Test connection function
async function testConnection() {
    try {
        const { data, error } = await supabase.from('orders').select('count', { count: 'exact', head: true });
        if (error) {
            console.error('❌ Supabase connection test failed:', error.message);
            return false;
        }
        console.log('✅ Supabase connection successful!');
        return true;
    } catch (e) {
        console.error('❌ Supabase connection error:', e.message);
        return false;
    }
}

// Run test if not in production (optional)
if (process.env.NODE_ENV !== 'production') {
    testConnection();
}

module.exports = { 
    supabase, 
    supabaseAdmin,
    testConnection 
};
