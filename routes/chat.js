const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../database');

// ============ PRIVATE CHAT ROUTES ============

// Get conversation between user and admin
router.get('/private/conversation', async (req, res) => {
    const { userId, otherId } = req.query;
    
    if (!userId || !otherId) {
        return res.status(400).json({ success: false, error: 'Missing userId or otherId' });
    }
    
    try {
        const { data: messages, error } = await supabaseAdmin
            .from('private_messages')
            .select('*')
            .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${userId})`)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        res.json({ success: true, messages: messages || [] });
    } catch (error) {
        console.error('Error in /private/conversation:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send private message
router.post('/private/send', async (req, res) => {
    const { sender_id, receiver_id, sender_name, receiver_name, message } = req.body;
    
    if (!sender_id || !receiver_id || !message) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    try {
        const { data, error } = await supabaseAdmin
            .from('private_messages')
            .insert([{
                sender_id,
                receiver_id,
                sender_name: sender_name || null,
                receiver_name: receiver_name || null,
                message,
                is_read: false,
                created_at: new Date().toISOString()
            }])
            .select();
        
        if (error) throw error;
        
        res.json({ success: true, message: data[0] });
    } catch (error) {
        console.error('Error in /private/send:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mark messages as read
router.post('/private/mark-read/:userId', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const { error } = await supabaseAdmin
            .from('private_messages')
            .update({ is_read: true })
            .eq('sender_id', userId)
            .eq('receiver_id', 'admin')
            .eq('is_read', false);
        
        if (error) throw error;
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error in /private/mark-read:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get unread count for user
router.get('/private/unread/:userId', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const { count, error } = await supabaseAdmin
            .from('private_messages')
            .select('*', { count: 'exact', head: true })
            .eq('receiver_id', userId)
            .eq('is_read', false);
        
        if (error) throw error;
        
        res.json({ success: true, unreadCount: count || 0 });
    } catch (error) {
        console.error('Error in /private/unread:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ GLOBAL CHAT ROUTES ============

// Get global messages
router.get('/messages', async (req, res) => {
    try {
        const { data: messages, error } = await supabaseAdmin
            .from('global_messages')
            .select('*')
            .order('created_at', { ascending: true })
            .limit(100);
        
        if (error) throw error;
        
        res.json({ success: true, messages: messages || [] });
    } catch (error) {
        console.error('Error in /messages:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send global message
router.post('/send', async (req, res) => {
    const { user_id, username, message, is_admin } = req.body;
    
    if (!user_id || !message) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    try {
        const { data, error } = await supabaseAdmin
            .from('global_messages')
            .insert([{
                user_id,
                username: username || 'User',
                message,
                is_admin: is_admin || false,
                created_at: new Date().toISOString()
            }])
            .select();
        
        if (error) throw error;
        
        res.json({ success: true, message: data[0] });
    } catch (error) {
        console.error('Error in /send:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
