const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables!');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function getNextUserId() {
    try {
        const { data, error } = await supabaseAdmin
            .from('user_stats')
            .select('user_id')
            .order('user_id', { ascending: false })
            .limit(1);
        
        if (error) {
            console.error('Error getting next user ID:', error);
            return `ATH-${Date.now()}`;
        }
        
        let nextId = 10001;
        
        if (data && data.length > 0 && data[0].user_id) {
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

async function createNewUser(phone, username) {
    try {
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
        
        const userId = await getNextUserId();
        
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

async function isPhoneBlocked(phone) {
    const stats = await getUserStats(phone);
    return stats?.blocked === true;
}

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

async function testConnection() {
    try {
        const { error } = await supabaseAdmin.from('orders').select('count', { count: 'exact', head: true });
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

if (process.env.NODE_ENV !== 'production') {
    testConnection();
}

module.exports = { 
    supabase, 
    supabaseAdmin,
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
