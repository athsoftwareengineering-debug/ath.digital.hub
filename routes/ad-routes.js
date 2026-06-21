// routes/ad-routes.js
const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../database.js');

function isAuthenticated(req, res, next) {
    if (req.session.isAdmin) next();
    else res.status(401).json({ success: false, error: 'Unauthorized' });
}

// Get ads (public)
router.get('/ads', async (req, res) => {
    try {
        const today = new Date().toISOString().slice(0,10);
        const { data, error } = await supabaseAdmin
            .from('ads')
            .select('*')
            .is('deleted_at', null)
            .order('display_weight', { ascending: false });
        
        if (error) throw error;
        const activeAds = (data || []).filter(ad => 
            ad.active === true && (!ad.expiry_date || ad.expiry_date >= today)
        );
        res.json({ success: true, ads: activeAds });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get ads (admin)
router.get('/admin/ads', isAuthenticated, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('ads')
            .select('*')
            .is('deleted_at', null)
            .order('display_weight', { ascending: false });
        
        if (error) throw error;
        res.json({ success: true, ads: data || [] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Create ad
router.post('/admin/ads', isAuthenticated, async (req, res) => {
    try {
        const { name, image_url, destination_url, alt_text, display_weight, expiry_date } = req.body;
        if (!name || !image_url || !destination_url) {
            return res.status(400).json({ success: false, error: 'Required fields missing' });
        }
        const { data, error } = await supabaseAdmin
            .from('ads')
            .insert([{
                name, image_url, destination_url, alt_text: alt_text || null,
                display_weight: display_weight || 5, expiry_date: expiry_date || null,
                active: true, clicks: 0, views: 0, created_at: new Date().toISOString()
            }])
            .select();
        if (error) throw error;
        res.json({ success: true, ad: data[0] });
    } catch (err) {
        console.error('Error creating ad:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Update ad
router.put('/admin/ads/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, image_url, destination_url, alt_text, active, display_weight, expiry_date } = req.body;
        const { error } = await supabaseAdmin
            .from('ads')
            .update({ 
                name, image_url, destination_url, alt_text, active, 
                display_weight, expiry_date, updated_at: new Date().toISOString() 
            })
            .eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating ad:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Delete ad (soft delete)
router.delete('/admin/ads/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseAdmin
            .from('ads')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting ad:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Track ad click
router.post('/ads/:id/click', async (req, res) => {
    try {
        const { id } = req.params;
        // Increment click count
        const { error } = await supabaseAdmin.rpc('increment_ad_clicks', { ad_id: parseInt(id) });
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('Error tracking click:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Track ad view
router.post('/ads/:id/view', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseAdmin.rpc('increment_ad_views', { ad_id: parseInt(id) });
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('Error tracking view:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get ad settings
router.get('/ad-settings', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('ad_settings')
            .select('*')
            .eq('id', 1)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        res.json({ 
            success: true, 
            settings: data || { 
                rotation_mode: 'weighted', 
                auto_cycle_seconds: 0, 
                show_navigation: true 
            } 
        });
    } catch (err) {
        console.error('Error getting ad settings:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Update ad settings
router.put('/admin/ad-settings', isAuthenticated, async (req, res) => {
    try {
        const { rotation_mode, auto_cycle_seconds, show_navigation } = req.body;
        const { error } = await supabaseAdmin
            .from('ad_settings')
            .upsert({ 
                id: 1, 
                rotation_mode, 
                auto_cycle_seconds, 
                show_navigation, 
                updated_at: new Date().toISOString() 
            });
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating ad settings:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
