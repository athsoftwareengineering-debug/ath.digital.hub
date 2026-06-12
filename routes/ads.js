const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../database');

// ==================== AUTHENTICATION MIDDLEWARE ====================
function isAuthenticated(req, res, next) {
    // Session ရှိမရှိ စစ်ဆေးပါ
    if (!req.session) {
        return res.status(401).json({ success: false, error: 'Session not initialized' });
    }
    if (req.session.isAdmin) {
        next();
    } else {
        res.status(401).json({ success: false, error: 'Unauthorized' });
    }
}

// ==================== PUBLIC ADS API (No Authentication Required) ====================

// ကြော်ငြာများရယူရန် (သုံးစွဲသူ)
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
        console.error('Error fetching ads:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ကြော်ငြာဆက်တင်ရယူရန် (သုံးစွဲသူ)
router.get('/ad-settings', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('ad_settings')
            .select('*')
            .eq('id', 1)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        res.json({ success: true, settings: data || { rotation_mode: 'weighted', auto_cycle_seconds: 0, show_navigation: true } });
    } catch (err) {
        console.error('Error fetching ad settings:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ကလစ်ရေတွက်ရန် (သုံးစွဲသူ)
router.post('/ads/:id/click', async (req, res) => {
    try {
        const { id } = req.params;
        await supabaseAdmin.rpc('increment_ad_clicks', { ad_id: parseInt(id) });
        res.json({ success: true });
    } catch (err) {
        console.error('Error incrementing click:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// မြင်ရအကြိမ်ရေတွက်ရန် (သုံးစွဲသူ)
router.post('/ads/:id/view', async (req, res) => {
    try {
        const { id } = req.params;
        await supabaseAdmin.rpc('increment_ad_views', { ad_id: parseInt(id) });
        res.json({ success: true });
    } catch (err) {
        console.error('Error incrementing view:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==================== ADMIN ADS API (Authentication Required) ====================

// ကြော်ငြာများရယူရန် (အဒ်မင်)
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
        console.error('Error fetching admin ads:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ကြော်ငြာအသစ်ထည့်ရန်
router.post('/admin/ads', isAuthenticated, async (req, res) => {
    try {
        const { name, image_url, destination_url, alt_text, display_weight, expiry_date } = req.body;
        if (!name || !image_url || !destination_url) {
            return res.status(400).json({ success: false, error: 'Required fields missing' });
        }
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
                clicks: 0, 
                views: 0, 
                created_at: new Date().toISOString()
            }])
            .select();
        if (error) throw error;
        res.json({ success: true, ad: data[0] });
    } catch (err) {
        console.error('Error creating ad:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ကြော်ငြာပြင်ရန်
router.put('/admin/ads/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, image_url, destination_url, alt_text, active, display_weight, expiry_date } = req.body;
        const { error } = await supabaseAdmin
            .from('ads')
            .update({ 
                name, 
                image_url, 
                destination_url, 
                alt_text, 
                active, 
                display_weight, 
                expiry_date, 
                updated_at: new Date().toISOString() 
            })
            .eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating ad:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ကြော်ငြာဖျက်ရန် (Soft Delete)
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

// ကြော်ငြာဆက်တင်သိမ်းရန်
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
        console.error('Error saving ad settings:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
