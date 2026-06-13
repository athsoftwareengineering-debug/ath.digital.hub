// routes/admin.js - ATH DIGITAL HUB Admin Routes (Complete)
const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../database');

// ============================================================
// ADMIN AUTHENTICATION MIDDLEWARE
// ============================================================

function isAdmin(req, res, next) {
    // Check multiple possible sources for admin authentication
    const token = req.headers.authorization?.split(' ')[1] || 
                  req.cookies?.adminToken || 
                  req.session?.adminToken;
    
    if (token === 'logged_in' || (req.session && req.session.isAdmin)) {
        next();
    } else {
        res.status(401).json({ success: false, error: 'Unauthorized. Please login as Admin first.' });
    }
}

// ============================================================
// USERS MANAGEMENT ROUTES
// ============================================================

// GET /api/admin/users - Get all users for admin chat
router.get('/users', isAdmin, async (req, res) => {
    console.log('📋 GET /api/admin/users - Fetching users...');
    
    try {
        // Get all non-admin users from user_stats table
        const { data: users, error } = await supabaseAdmin
            .from('user_stats')
            .select('user_id, phone, username, created_at, blocked, suspect_flag')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }
        
        // Get unread count for each user (messages from user to admin that are not read yet)
        for (const user of users || []) {
            const { count, error: countError } = await supabaseAdmin
                .from('private_messages')
                .select('*', { count: 'exact', head: true })
                .eq('sender_id', user.user_id)
                .eq('receiver_id', 'admin')
                .eq('is_read', false);
            
            user.unread_count = count || 0;
        }
        
        console.log(`✅ Found ${users?.length || 0} users`);
        res.json({ success: true, users: users || [] });
        
    } catch (error) {
        console.error('❌ Error in /api/admin/users:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/admin/users/search - Search users by phone, name, or ID
router.get('/users/search', isAdmin, async (req, res) => {
    const { q } = req.query;
    
    if (!q) {
        return res.status(400).json({ success: false, error: 'Search query required' });
    }
    
    try {
        const { data: users, error } = await supabaseAdmin
            .from('user_stats')
            .select('user_id, phone, username, created_at, blocked, suspect_flag')
            .or(`phone.ilike.%${q}%,username.ilike.%${q}%,user_id.ilike.%${q}%`)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        res.json({ success: true, users: users || [] });
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/admin/user-block - Block or unblock user
router.post('/user-block', isAdmin, async (req, res) => {
    const { phone, block } = req.body;
    
    if (!phone) {
        return res.status(400).json({ success: false, error: 'Phone number required' });
    }
    
    try {
        const { error } = await supabaseAdmin
            .from('user_stats')
            .update({ blocked: block, updated_at: new Date().toISOString() })
            .eq('phone', phone);
        
        if (error) throw error;
        
        res.json({ success: true, message: block ? 'User blocked' : 'User unblocked' });
    } catch (error) {
        console.error('Error blocking/unblocking user:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/admin/clear-suspect - Clear suspect flag from user
router.post('/clear-suspect', isAdmin, async (req, res) => {
    const { phone } = req.body;
    
    if (!phone) {
        return res.status(400).json({ success: false, error: 'Phone number required' });
    }
    
    try {
        const { error } = await supabaseAdmin
            .from('user_stats')
            .update({ suspect_flag: false, updated_at: new Date().toISOString() })
            .eq('phone', phone);
        
        if (error) throw error;
        
        res.json({ success: true, message: 'Suspect flag cleared' });
    } catch (error) {
        console.error('Error clearing suspect flag:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/admin/user-delete - Delete user account and all associated data
router.post('/user-delete', isAdmin, async (req, res) => {
    const { phone } = req.body;
    
    if (!phone) {
        return res.status(400).json({ success: false, error: 'Phone number required' });
    }
    
    try {
        // Get user_id first
        const { data: user, error: fetchError } = await supabaseAdmin
            .from('user_stats')
            .select('user_id')
            .eq('phone', phone)
            .single();
        
        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
        
        // Delete from user_stats
        const { error: statsError } = await supabaseAdmin
            .from('user_stats')
            .delete()
            .eq('phone', phone);
        
        if (statsError) throw statsError;
        
        // Delete user's private messages
        if (user && user.user_id) {
            await supabaseAdmin
                .from('private_messages')
                .delete()
                .or(`sender_id.eq.${user.user_id},receiver_id.eq.${user.user_id}`);
        }
        
        // Delete user's orders
        await supabaseAdmin
            .from('orders')
            .delete()
            .eq('phone', phone);
        
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/admin/user-delete-orders - Delete all orders for a user
router.post('/user-delete-orders', isAdmin, async (req, res) => {
    const { phone } = req.body;
    
    if (!phone) {
        return res.status(400).json({ success: false, error: 'Phone number required' });
    }
    
    try {
        const { error } = await supabaseAdmin
            .from('orders')
            .delete()
            .eq('phone', phone);
        
        if (error) throw error;
        
        res.json({ success: true, message: 'All orders deleted for this user' });
    } catch (error) {
        console.error('Error deleting orders:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// ADS MANAGEMENT ROUTES
// ============================================================

// GET /api/admin/ads - Get all ads
router.get('/ads', isAdmin, async (req, res) => {
    console.log('📋 GET /api/admin/ads - Fetching ads...');
    
    try {
        const { data: ads, error } = await supabaseAdmin
            .from('ads')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        console.log(`✅ Found ${ads?.length || 0} ads`);
        res.json({ success: true, ads: ads || [] });
        
    } catch (error) {
        console.error('❌ Error in /api/admin/ads:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/admin/ads - Create new ad
router.post('/ads', isAdmin, async (req, res) => {
    const { name, image_url, destination_url, alt_text, display_weight, expiry_date } = req.body;
    
    if (!name || !image_url || !destination_url) {
        return res.status(400).json({ success: false, error: 'Missing required fields: name, image_url, destination_url' });
    }
    
    try {
        const { data, error } = await supabaseAdmin
            .from('ads')
            .insert([{
                name,
                image_url,
                destination_url,
                alt_text: alt_text || null,
                display_weight: display_weight || 5,
                expiry_date: expiry_date || null,
                active: true,
                views: 0,
                clicks: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select();
        
        if (error) throw error;
        
        res.json({ success: true, ad: data[0] });
    } catch (error) {
        console.error('Error creating ad:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/admin/ads/:id - Update ad
router.put('/ads/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, image_url, destination_url, alt_text, display_weight, expiry_date, active } = req.body;
    
    try {
        const { data, error } = await supabaseAdmin
            .from('ads')
            .update({
                name,
                image_url,
                destination_url,
                alt_text: alt_text || null,
                display_weight: display_weight || 5,
                expiry_date: expiry_date || null,
                active,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select();
        
        if (error) throw error;
        
        res.json({ success: true, ad: data[0] });
    } catch (error) {
        console.error('Error updating ad:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/admin/ads/:id - Delete ad
router.delete('/ads/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    
    try {
        await supabaseAdmin
            .from('ads')
            .delete()
            .eq('id', id);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting ad:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// ADS SETTINGS ROUTES
// ============================================================

// GET /api/admin/ad-settings - Get ad display settings
router.get('/ad-settings', isAdmin, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('ad_settings')
            .select('*')
            .maybeSingle();
        
        if (error && error.code !== 'PGRST116') throw error;
        
        res.json({ 
            success: true, 
            settings: data || { rotation_mode: 'weighted', auto_cycle_seconds: 0, show_navigation: true }
        });
    } catch (error) {
        console.error('Error getting ad settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/admin/ad-settings - Update ad display settings
router.put('/ad-settings', isAdmin, async (req, res) => {
    const { rotation_mode, auto_cycle_seconds, show_navigation } = req.body;
    
    try {
        // Check if settings exist
        const { data: existing } = await supabaseAdmin
            .from('ad_settings')
            .select('id')
            .maybeSingle();
        
        let result;
        if (existing) {
            result = await supabaseAdmin
                .from('ad_settings')
                .update({ 
                    rotation_mode, 
                    auto_cycle_seconds, 
                    show_navigation, 
                    updated_at: new Date().toISOString() 
                })
                .eq('id', existing.id);
        } else {
            result = await supabaseAdmin
                .from('ad_settings')
                .insert([{ rotation_mode, auto_cycle_seconds, show_navigation }]);
        }
        
        if (result.error) throw result.error;
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating ad settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// ORDER MANAGEMENT ROUTES
// ============================================================

// GET /api/admin/orders - Get all orders
router.get('/orders', isAdmin, async (req, res) => {
    try {
        const { data: orders, error } = await supabaseAdmin
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        res.json({ success: true, orders: orders || [] });
    } catch (error) {
        console.error('Error getting orders:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/admin/orders/:id/approve - Approve order
router.put('/orders/:id/approve', isAdmin, async (req, res) => {
    const { id } = req.params;
    
    try {
        const { error } = await supabaseAdmin
            .from('orders')
            .update({ 
                status: 'Approved', 
                activated_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', id);
        
        if (error) throw error;
        
        res.json({ success: true, message: 'Order approved' });
    } catch (error) {
        console.error('Error approving order:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/admin/orders/:id/reject - Reject order
router.put('/orders/:id/reject', isAdmin, async (req, res) => {
    const { id } = req.params;
    
    try {
        const { error } = await supabaseAdmin
            .from('orders')
            .update({ 
                status: 'Rejected', 
                updated_at: new Date().toISOString()
            })
            .eq('id', id);
        
        if (error) throw error;
        
        res.json({ success: true, message: 'Order rejected' });
    } catch (error) {
        console.error('Error rejecting order:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/admin/orders/:id - Delete order
router.delete('/orders/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    
    try {
        const { error } = await supabaseAdmin
            .from('orders')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        res.json({ success: true, message: 'Order deleted' });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/admin/cleanup-old - Clean up old pending/rejected orders (older than 30 days)
router.post('/cleanup-old', isAdmin, async (req, res) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    try {
        const { error } = await supabaseAdmin
            .from('orders')
            .delete()
            .or('status.eq.Pending,status.eq.Rejected')
            .lt('created_at', thirtyDaysAgo.toISOString());
        
        if (error) throw error;
        
        res.json({ success: true, message: 'Old orders cleaned up successfully' });
    } catch (error) {
        console.error('Error cleaning up orders:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/admin/system-reset - Reset entire system (DANGER! Use with caution)
router.post('/system-reset', isAdmin, async (req, res) => {
    const { confirm, keepProducts } = req.body;
    
    if (confirm !== 'RESET_ALL_DATA') {
        return res.status(400).json({ success: false, error: 'Confirmation required: type RESET_ALL_DATA' });
    }
    
    try {
        // Delete all orders
        await supabaseAdmin.from('orders').delete().neq('id', 0);
        
        // Delete all users except admin
        await supabaseAdmin.from('user_stats').delete().neq('user_id', 'admin');
        
        // Delete all private messages
        await supabaseAdmin.from('private_messages').delete().neq('id', 0);
        
        // Delete all global messages
        await supabaseAdmin.from('global_messages').delete().neq('id', 0);
        
        // Optionally delete products
        if (!keepProducts) {
            await supabaseAdmin.from('products').delete().neq('id', 0);
        }
        
        res.json({ success: true, message: 'System reset completed' });
    } catch (error) {
        console.error('Error resetting system:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// STATISTICS ROUTES
// ============================================================

// GET /api/admin/user-stats - Get user statistics for admin panel
router.get('/user-stats', isAdmin, async (req, res) => {
    try {
        const { data: stats, error } = await supabaseAdmin
            .from('user_stats')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        res.json({ success: true, stats: stats || [] });
    } catch (error) {
        console.error('Error getting user stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/admin/notifications - Get admin notifications
router.get('/notifications', isAdmin, async (req, res) => {
    try {
        const { data: notifications, error } = await supabaseAdmin
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (error) throw error;
        
        res.json({ success: true, notifications: notifications || [] });
    } catch (error) {
        console.error('Error getting notifications:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/admin/notifications/clear - Clear all notifications
router.post('/notifications/clear', isAdmin, async (req, res) => {
    try {
        const { error } = await supabaseAdmin
            .from('notifications')
            .delete()
            .neq('id', 0);
        
        if (error) throw error;
        
        res.json({ success: true, message: 'All notifications cleared' });
    } catch (error) {
        console.error('Error clearing notifications:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/admin/notifications/:id - Delete single notification
router.delete('/notifications/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    
    try {
        const { error } = await supabaseAdmin
            .from('notifications')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
