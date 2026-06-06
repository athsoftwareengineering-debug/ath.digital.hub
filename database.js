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

// ==================== USER ID AUTO-GENERATE FUNCTIONS ====================

/**
 * Get next available user ID
 * Format: ATH-10001, ATH-10002, etc.
 * @returns {Promise<string>} Next user ID
 */
async function getNextUserId() {
    try {
        const { data, error } = await supabaseAdmin
            .from('user_stats')
            .select('user_id')
            .order('user_id', { ascending: false })
            .limit(1);
        
        if (error) {
            console.error('Error getting next user ID:', error);
            // Fallback to timestamp-based ID
            return `ATH-${Date.now()}`;
        }
        
        let nextId = 10001; // Starting from ATH-10001
        
        if (data && data.length > 0 && data[0].user_id) {
            // Extract number from existing ID (ATH-10001 -> 10001)
            const match = data[0].user_id.match(/ATH-(\d+)/);
            if (match) {
                const lastId = parseInt(match[1]);
                nextId = lastId + 1;
            }
        }
        
        return `ATH-${nextId}`;
    } catch (e) {
        console.error('Exception in getNextUserId:', e);
        return `ATH-${Date.now()}`;
    }
}

/**
 * Create a new user with auto-generated user ID
 * @param {string} phone - User's phone number
 * @param {string} username - User's name
 * @returns {Promise<Object|null>} Created user object or null
 */
async function createNewUser(phone, username) {
    try {
        // Check if user already exists
        const { data: existing, error: checkError } = await supabaseAdmin
            .from('user_stats')
            .select('*')
            .eq('phone', phone)
            .maybeSingle();
        
        if (checkError && checkError.code !== 'PGRST116') {
            console.error('Error checking existing user:', checkError);
        }
        
        if (existing) {
            console.log(`📝 User already exists: ${phone} -> ID: ${existing.user_id}`);
            return existing;
        }
        
        // Get next available user ID
        const userId = await getNextUserId();
        
        // Create new user
        const { data, error } = await supabaseAdmin
            .from('user_stats')
            .insert([{
                phone: phone,
                username: username,
                user_id: userId,
                order_count: 0,
                reject_count: 0,
                suspect_flag: false,
                blocked: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select()
            .single();
        
        if (error) {
            console.error('Error creating new user:', error);
            return null;
        }
        
        console.log(`🆕 New user created: ${username} (${phone}) -> ID: ${userId}`);
        return data;
        
    } catch (e) {
        console.error('Exception in createNewUser:', e);
        return null;
    }
}

/**
 * Get user by phone number
 * @param {string} phone - User's phone number
 * @returns {Promise<Object|null>} User object or null
 */
async function getUserByPhone(phone) {
    try {
        const { data, error } = await supabaseAdmin
            .from('user_stats')
            .select('*')
            .eq('phone', phone)
            .maybeSingle();
        
        if (error && error.code !== 'PGRST116') {
            console.error('Error getting user by phone:', error);
        }
        
        return data || null;
    } catch (e) {
        console.error('Exception in getUserByPhone:', e);
        return null;
    }
}

/**
 * Get user by user ID
 * @param {string} userId - User's ID (e.g., ATH-10001)
 * @returns {Promise<Object|null>} User object or null
 */
async function getUserByUserId(userId) {
    try {
        const { data, error } = await supabaseAdmin
            .from('user_stats')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
        
        if (error && error.code !== 'PGRST116') {
            console.error('Error getting user by ID:', error);
        }
        
        return data || null;
    } catch (e) {
        console.error('Exception in getUserByUserId:', e);
        return null;
    }
}

/**
 * Update user information
 * @param {string} phone - User's phone number
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object|null>} Updated user object or null
 */
async function updateUser(phone, updates) {
    try {
        const { data, error } = await supabaseAdmin
            .from('user_stats')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('phone', phone)
            .select()
            .single();
        
        if (error) {
            console.error('Error updating user:', error);
            return null;
        }
        
        return data;
    } catch (e) {
        console.error('Exception in updateUser:', e);
        return null;
    }
}

/**
 * Get user stats with order count and reject count
 * @param {string} phone - User's phone number
 * @returns {Promise<Object|null>} User stats object or null
 */
async function getUserStats(phone) {
    try {
        const { data, error } = await supabaseAdmin
            .from('user_stats')
            .select('*')
            .eq('phone', phone)
            .maybeSingle();
        
        if (error && error.code !== 'PGRST116') {
            console.error('Error getting user stats:', error);
        }
        return data;
    } catch (e) {
        console.error('Exception in getUserStats:', e);
        return null;
    }
}

/**
 * Update user statistics (order count, reject count)
 * @param {string} phone - User's phone number
 * @param {boolean} isRejected - Whether this order was rejected
 * @returns {Promise<void>}
 */
async function updateUserStats(phone, isRejected = false) {
    try {
        const existing = await getUserStats(phone);
        
        if (existing) {
            const updateData = {
                order_count: (existing.order_count || 0) + 1,
                updated_at: new Date().toISOString()
            };
            if (isRejected) {
                updateData.reject_count = (existing.reject_count || 0) + 1;
                const newRejectCount = (existing.reject_count || 0) + 1;
                const newOrderCount = (existing.order_count || 0) + 1;
                if (newOrderCount >= 5 && (newRejectCount / newOrderCount) > 0.5) {
                    updateData.suspect_flag = true;
                }
            }
            
            await supabaseAdmin
                .from('user_stats')
                .update(updateData)
                .eq('phone', phone);
        } else {
            await supabaseAdmin
                .from('user_stats')
                .insert([{
                    phone: phone,
                    order_count: 1,
                    reject_count: isRejected ? 1 : 0,
                    suspect_flag: false,
                    blocked: false,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }]);
        }
        console.log(`📊 Updated stats for ${phone}: ${isRejected ? 'rejected' : 'new order'}`);
    } catch (e) {
        console.error('Error updating user stats:', e);
    }
}

/**
 * Check if phone is blocked
 * @param {string} phone - User's phone number
 * @returns {Promise<boolean>} True if blocked
 */
async function isPhoneBlocked(phone) {
    const stats = await getUserStats(phone);
    return stats?.blocked === true;
}

/**
 * Get all users (for admin panel)
 * @returns {Promise<Array>} List of all users
 */
async function getAllUsers() {
    try {
        const { data, error } = await supabaseAdmin
            .from('user_stats')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error getting all users:', error);
            return [];
        }
        
        return data || [];
    } catch (e) {
        console.error('Exception in getAllUsers:', e);
        return [];
    }
}

/**
 * Search users by phone or username
 * @param {string} searchTerm - Search term
 * @returns {Promise<Array>} List of matching users
 */
async function searchUsers(searchTerm) {
    try {
        const { data, error } = await supabaseAdmin
            .from('user_stats')
            .select('*')
            .or(`phone.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%,user_id.ilike.%${searchTerm}%`)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error searching users:', error);
            return [];
        }
        
        return data || [];
    } catch (e) {
        console.error('Exception in searchUsers:', e);
        return [];
    }
}

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

// Run test if not in production
if (process.env.NODE_ENV !== 'production') {
    testConnection();
}

module.exports = { 
    supabase, 
    supabaseAdmin,
    // User ID functions
    getNextUserId,
    createNewUser,
    getUserByPhone,
    getUserByUserId,
    updateUser,
    getUserStats,
    updateUserStats,
    isPhoneBlocked,
    getAllUsers,
    searchUsers,
    testConnection
};
