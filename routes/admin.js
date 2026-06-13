const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../database');

// Admin authentication middleware
function isAdmin(req, res, next) {
    const token = req.headers.authorization || req.cookies?.adminToken;
    if (token === 'logged_in') {
        next();
    } else {
        res.status(401).json({ success: false, error: 'Unauthorized' });
    }
}

// ============ USERS ROUTES ============

// Get all users for admin chat
router.get('/users', isAdmin, async (req, res) => {
    try {
        // Get all non-admin users from user_stats
        const { data: users, error } = await supabaseAdmin
            .from('user_stats')
            .select('user_id, phone, username, created_at, blocked, suspect_flag')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Get unread count for each user (messages from user to admin)
        for (const user of users) {
            const { count, error: countError } = await supabaseAdmin
                .from('private_messages')
                .select('*', { count: 'exact', head: true })
                .eq('sender_id', user.user_id)
                .eq('receiver_id', 'admin')
                .eq('is_read', false);
            
            user.unread_count = count || 0;
        }
        
        res.json({ success: true, users: users || [] });
    } catch (error) {
        console.error('Error in /admin/users:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ ADS ROUTES ============

// Get all ads
router.get('/ads', isAdmin, async (req, res) => {
    try {
        const { data: ads, error } = await supabaseAdmin
            .from('ads')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        res.json({ success: true, ads: ads || [] });
    } catch (error) {
        console.error('Error in /admin/ads:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create new ad
router.post('/ads', isAdmin, async (req, res) => {
    const { name, image_url, destination_url, alt_text, display_weight, expiry_date } = req.body;
    
    if (!name || !image_url || !destination_url) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
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
                created_at: new Date().toISOString()
            }])
            .select();
        
        if (error) throw error;
        
        res.json({ success: true, ad: data[0] });
    } catch (error) {
        console.error('Error in POST /admin/ads:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update ad
router.put('/ads/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    try {
        const { data, error } = await supabaseAdmin
            .from('ads')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select();
        
        if (error) throw error;
        
        res.json({ success: true, ad: data[0] });
    } catch (error) {
        console.error('Error in PUT /admin/ads:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete ad
router.delete('/ads/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    
    try {
        await supabaseAdmin
            .from('ads')
            .delete()
            .eq('id', id);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error in DELETE /admin/ads:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ AD SETTINGS ROUTES ============

// Get ad settings
router.get('/ad-settings', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('ad_settings')
            .select('*')
            .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        
        res.json({ 
            success: true, 
            settings: data || { rotation_mode: 'weighted', auto_cycle_seconds: 0, show_navigation: true }
        });
    } catch (error) {
        console.error('Error in /admin/ad-settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update ad settings
router.put('/ad-settings', isAdmin, async (req, res) => {
    const { rotation_mode, auto_cycle_seconds, show_navigation } = req.body;
    
    try {
        // Check if settings exist
        const { data: existing } = await supabaseAdmin
            .from('ad_settings')
            .select('id')
            .single();
        
        let result;
        if (existing) {
            result = await supabaseAdmin
                .from('ad_settings')
                .update({ rotation_mode, auto_cycle_seconds, show_navigation, updated_at: new Date().toISOString() })
                .eq('id', existing.id);
        } else {
            result = await supabaseAdmin
                .from('ad_settings')
                .insert([{ rotation_mode, auto_cycle_seconds, show_navigation }]);
        }
        
        if (result.error) throw result.error;
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error in PUT /admin/ad-settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
