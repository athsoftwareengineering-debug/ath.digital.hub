// routes/ads.js
const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../database');

// ==================== AD MANAGEMENT ROUTES ====================

/**
 * GET /api/admin/ads
 * ကြော်ငြာအားလုံးကို ရယူခြင်း
 */
router.get('/admin/ads', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('ads')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        res.json({ success: true, ads: data || [] });
    } catch (error) {
        console.error('Error fetching ads:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/admin/ads
 * ကြော်ငြာအသစ်ဖန်တီးခြင်း
 */
router.post('/admin/ads', async (req, res) => {
    try {
        const { name, image_url, destination_url, alt_text, display_weight, expiry_date } = req.body;
        
        // Validation
        if (!name || !image_url || !destination_url) {
            return res.status(400).json({ 
                success: false, 
                error: 'Name, image_url and destination_url are required' 
            });
        }
        
        if (display_weight && (display_weight < 1 || display_weight > 20)) {
            return res.status(400).json({
                success: false,
                error: 'Display weight must be between 1 and 20'
            });
        }
        
        const { data, error } = await supabaseAdmin
            .from('ads')
            .insert([{
                name: name.trim(),
                image_url: image_url.trim(),
                destination_url: destination_url.trim(),
                alt_text: alt_text ? alt_text.trim() : null,
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

/**
 * PUT /api/admin/ads/:id
 * ကြော်ငြာကို ပြင်ဆင်ခြင်း
 */
router.put('/admin/ads/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, image_url, destination_url, alt_text, display_weight, expiry_date, active } = req.body;
        
        const updateData = {};
        if (name !== undefined) updateData.name = name.trim();
        if (image_url !== undefined) updateData.image_url = image_url.trim();
        if (destination_url !== undefined) updateData.destination_url = destination_url.trim();
        if (alt_text !== undefined) updateData.alt_text = alt_text ? alt_text.trim() : null;
        if (display_weight !== undefined) {
            if (display_weight < 1 || display_weight > 20) {
                return res.status(400).json({
                    success: false,
                    error: 'Display weight must be between 1 and 20'
                });
            }
            updateData.display_weight = display_weight;
        }
        if (expiry_date !== undefined) updateData.expiry_date = expiry_date || null;
        if (active !== undefined) updateData.active = active;
        updateData.updated_at = new Date().toISOString();
        
        const { data, error } = await supabaseAdmin
            .from('ads')
            .update(updateData)
            .eq('id', parseInt(id))
            .select();
        
        if (error) throw error;
        if (!data || data.length === 0) {
            return res.status(404).json({ success: false, error: 'Ad not found' });
        }
        res.json({ success: true, ad: data[0] });
    } catch (error) {
        console.error('Error updating ad:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/admin/ads/:id
 * ကြော်ငြာကို ဖျက်ခြင်း
 */
router.delete('/admin/ads/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { error } = await supabaseAdmin
            .from('ads')
            .delete()
            .eq('id', parseInt(id));
        
        if (error) throw error;
        res.json({ success: true, message: 'Ad deleted successfully' });
    } catch (error) {
        console.error('Error deleting ad:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/ads/:id/view
 * ကြော်ငြာ ကြည့်ရှုမှု မှတ်တမ်းတင်ခြင်း (Public)
 */
router.post('/ads/:id/view', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Try RPC function first
        try {
            const { error } = await supabaseAdmin.rpc('increment_ad_view', {
                ad_id: parseInt(id)
            });
            if (!error) {
                return res.json({ success: true });
            }
        } catch (e) {
            // RPC function doesn't exist, use manual update
        }
        
        // Manual increment
        const { data, error: fetchError } = await supabaseAdmin
            .from('ads')
            .select('views')
            .eq('id', parseInt(id))
            .single();
        
        if (fetchError) {
            // Ad might not exist, still return success
            return res.json({ success: true });
        }
        
        const { error: updateError } = await supabaseAdmin
            .from('ads')
            .update({ views: (data?.views || 0) + 1 })
            .eq('id', parseInt(id));
        
        if (updateError) throw updateError;
        res.json({ success: true });
    } catch (error) {
        console.error('Error tracking ad view:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/ads/:id/click
 * ကြော်ငြာ နှိပ်မှု မှတ်တမ်းတင်ခြင်း (Public)
 */
router.post('/ads/:id/click', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Try RPC function first
        try {
            const { error } = await supabaseAdmin.rpc('increment_ad_click', {
                ad_id: parseInt(id)
            });
            if (!error) {
                return res.json({ success: true });
            }
        } catch (e) {
            // RPC function doesn't exist, use manual update
        }
        
        // Manual increment
        const { data, error: fetchError } = await supabaseAdmin
            .from('ads')
            .select('clicks')
            .eq('id', parseInt(id))
            .single();
        
        if (fetchError) {
            return res.json({ success: true });
        }
        
        const { error: updateError } = await supabaseAdmin
            .from('ads')
            .update({ clicks: (data?.clicks || 0) + 1 })
            .eq('id', parseInt(id));
        
        if (updateError) throw updateError;
        res.json({ success: true });
    } catch (error) {
        console.error('Error tracking ad click:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/ad-settings
 * ကြော်ငြာ ဆက်တင်များကို ရယူခြင်း (Public)
 */
router.get('/ad-settings', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('ad_settings')
            .select('*')
            .limit(1)
            .single();
        
        // If table doesn't exist or no data, return defaults
        if (error && error.code === 'PGRST116') {
            const defaultSettings = {
                rotation_mode: 'weighted',
                auto_cycle_seconds: 0,
                show_navigation: true
            };
            // Create default settings in database
            try {
                await supabaseAdmin
                    .from('ad_settings')
                    .insert([{
                        id: 1,
                        ...defaultSettings,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }]);
            } catch (e) {
                // Table might not exist, just return defaults
            }
            return res.json({ success: true, settings: defaultSettings });
        }
        
        if (error) throw error;
        
        res.json({ success: true, settings: data || {} });
    } catch (error) {
        console.error('Error fetching ad settings:', error);
        res.json({ 
            success: true, 
            settings: {
                rotation_mode: 'weighted',
                auto_cycle_seconds: 0,
                show_navigation: true
            }
        });
    }
});

/**
 * PUT /api/admin/ad-settings
 * ကြော်ငြာ ဆက်တင်များကို ပြင်ဆင်ခြင်း (Admin only)
 */
router.put('/admin/ad-settings', async (req, res) => {
    try {
        const { rotation_mode, auto_cycle_seconds, show_navigation } = req.body;
        
        const settings = {
            id: 1,
            rotation_mode: rotation_mode || 'weighted',
            auto_cycle_seconds: auto_cycle_seconds || 0,
            show_navigation: show_navigation !== undefined ? show_navigation : true,
            updated_at: new Date().toISOString()
        };
        
        const { data, error } = await supabaseAdmin
            .from('ad_settings')
            .upsert(settings)
            .select();
        
        if (error) {
            // If table doesn't exist, return success with the settings
            console.log('⚠️ ad_settings table not found, returning settings as is');
            return res.json({ success: true, settings: settings });
        }
        
        res.json({ success: true, settings: data[0] || settings });
    } catch (error) {
        console.error('Error updating ad settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/ads/active
 * ပြသရန် ကြော်ငြာများကို ရယူခြင်း (Public)
 */
router.get('/ads/active', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const { data, error } = await supabaseAdmin
            .from('ads')
            .select('*')
            .eq('active', true)
            .or(`expiry_date.is.null,expiry_date.gte.${today}`)
            .order('display_weight', { ascending: false })
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        res.json({ success: true, ads: data || [] });
    } catch (error) {
        console.error('Error fetching active ads:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
