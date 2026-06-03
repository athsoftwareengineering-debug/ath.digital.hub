// server.js - Express Server (Optimized)
const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const { supabase, supabaseAdmin } = require('./database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware (Increased limits for handling large Base64/Images safely)
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static('uploads'));

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB Limit
});

// Serve frontend views
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Submit Order API
app.post('/api/orders', upload.single('screenshot'), async (req, res) => {
    try {
        const { orderId, phone, planCode, planName, price } = req.body;
        
        if (!orderId || !phone || !planCode || !planName || !price) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Payment screenshot is required' });
        }

        // Check if user is blocked
        const { data: userStat } = await supabase
            .from('user_stats')
            .select('blocked')
            .eq('phone', phone)
            .single();

        if (userStat && userStat.blocked) {
            // Delete uploaded file if user is blocked
            fs.unlinkSync(req.file.path);
            return res.status(403).json({ success: false, error: 'Your phone number has been suspended.' });
        }

        const screenshotUrl = `/uploads/${req.file.filename}`;

        // Insert order into Supabase
        const { error: orderError } = await supabase
            .from('orders')
            .insert([{
                id: orderId,
                phone,
                plan_code: planCode,
                plan_name: planName,
                price: parseFloat(price),
                screenshot_url: screenshotUrl,
                status: 'pending'
            }]);

        if (orderError) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(500).json({ success: false, error: orderError.message });
        }

        // Upsert user stats
        const { data: existingUser } = await supabase
            .from('user_stats')
            .select('order_count')
            .eq('phone', phone)
            .single();

        if (existingUser) {
            await supabase
                .from('user_stats')
                .update({ order_count: existingUser.order_count + 1, updated_at: new Date() })
                .eq('phone', phone);
        } else {
            await supabase
                .from('user_stats')
                .insert([{ phone, order_count: 1 }]);
        }

        res.json({ success: true, message: 'Order submitted successfully' });
    } catch (error) {
        console.error('Error submitting order:', error);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Check Phone Status (Blocked/Suspect)
app.get('/api/user-status/:phone', async (req, res) => {
    try {
        const { phone } = req.params;
        const { data, error } = await supabase
            .from('user_stats')
            .select('*')
            .eq('phone', phone)
            .single();
            
        if (error && error.code !== 'PGRST116') {
            return res.status(500).json({ success: false, error: error.message });
        }
        
        res.json({ success: true, status: data || { blocked: false, suspect_flag: false } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Fetch Active Orders for Admin
app.get('/api/admin/orders', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) return res.status(500).json({ success: false, error: error.message });
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Fetch Users for Admin
app.get('/api/admin/users', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('user_stats')
            .select('*')
            .order('updated_at', { ascending: false });
            
        if (error) return res.status(500).json({ success: false, error: error.message });
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Approve Order
app.post('/api/admin/orders/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseAdmin
            .from('orders')
            .update({ status: 'approved', updated_at: new Date() })
            .eq('id', id);
            
        if (error) return res.status(500).json({ success: false, error: error.message });
        res.json({ success: true, message: 'Order approved' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reject Order
app.post('/api/admin/orders/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data: order } = await supabaseAdmin
            .from('orders')
            .select('phone')
            .eq('id', id)
            .single();

        const { error } = await supabaseAdmin
            .from('orders')
            .update({ status: 'rejected', updated_at: new Date() })
            .eq('id', id);
            
        if (error) return res.status(500).json({ success: false, error: error.message });

        if (order) {
            const { data: userStat } = await supabaseAdmin
                .from('user_stats')
                .select('reject_count')
                .eq('phone', order.phone)
                .single();

            if (userStat) {
                const newRejectCount = userStat.reject_count + 1;
                const flagSuspect = newRejectCount >= 3;
                await supabaseAdmin
                    .from('user_stats')
                    .update({ 
                        reject_count: newRejectCount, 
                        suspect_flag: flagSuspect,
                        updated_at: new Date() 
                    })
                    .eq('phone', order.phone);
            }
        }
        res.json({ success: true, message: 'Order rejected' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update User Status (Block/Unblock/Clear)
app.post('/api/admin/users/:phone/status', async (req, res) => {
    try {
        const { phone } = req.params;
        const { blocked, suspect_flag, clear_rejects } = req.body;
        
        let updateData = { updated_at: new Date() };
        if (blocked !== undefined) updateData.blocked = blocked;
        if (suspect_flag !== undefined) updateData.suspect_flag = suspect_flag;
        if (clear_rejects) {
            updateData.reject_count = 0;
            updateData.suspect_flag = false;
        }

        const { error } = await supabaseAdmin
            .from('user_stats')
            .update(updateData)
            .eq('phone', phone);

        if (error) return res.status(500).json({ success: false, error: error.message });
        res.json({ success: true, message: 'User updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete Order API
app.delete('/api/admin/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseAdmin.from('orders').delete().eq('id', id);
        if (error) return res.status(500).json({ success: false, error: error.message });
        res.json({ success: true, message: 'Order deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin Login
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid password' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
