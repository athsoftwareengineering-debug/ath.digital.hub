// server.js - Complete Server with OTP Login & Balance API
const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const session = require('express-session');
const { supabase, supabaseAdmin, saveOTP, verifyOTP, getUserBalance } = require('./database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use(session({
    secret: 'mytel-vip-store-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 day
}));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static('uploads'));

// ==================== File Upload Config ====================
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) return cb(null, true);
        cb(new Error('Only images are allowed'));
    }
});

// ==================== SEND OTP VIA MIATEL SMS API ====================
async function sendOTP(phone, otp) {
    try {
        // Format phone to international format (remove leading 0)
        let formattedPhone = phone;
        if (phone.startsWith('0')) {
            formattedPhone = '959' + phone.substring(1);
        }
        
        const message = `Your ATH DIGITAL HUB verification code is: ${otp}. Valid for 5 minutes.`;
        
        // Miatel Official SMS API
        const response = await axios.get(process.env.MIATEL_SMS_URL, {
            params: {
                username: process.env.MIATEL_SMS_USERNAME,
                password: process.env.MIATEL_SMS_PASSWORD,
                to: formattedPhone,
                text: message
            },
            timeout: 10000
        });
        
        console.log(`✅ OTP sent to ${phone}: ${otp}`);
        return true;
    } catch (error) {
        console.error('SMS API Error:', error.message);
        // Fallback: For testing, return true (in production, fail properly)
        return false;
    }
}

// Generate 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ==================== AUTH API ====================

// 1. Send OTP
app.post('/api/auth/send-otp', async (req, res) => {
    try {
        const { phone } = req.body;
        
        if (!phone || phone.length < 9) {
            return res.status(400).json({ success: false, error: 'Valid phone number required' });
        }
        
        const otp = generateOTP();
        saveOTP(phone, otp);
        
        const sent = await sendOTP(phone, otp);
        
        if (sent) {
            res.json({ success: true, message: 'OTP sent successfully' });
        } else {
            res.status(500).json({ success: false, error: 'Failed to send OTP. Please try again.' });
        }
    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Verify OTP & Login
app.post('/api/auth/verify-otp', async (req, res) => {
    try {
        const { phone, otp } = req.body;
        
        if (!phone || !otp) {
            return res.status(400).json({ success: false, error: 'Phone and OTP required' });
        }
        
        const isValid = verifyOTP(phone, otp);
        
        if (isValid) {
            req.session.userPhone = phone;
            req.session.isAuthenticated = true;
            
            // Check if user exists in DB, if not create
            const { data: existing } = await supabaseAdmin
                .from('user_stats')
                .select('phone')
                .eq('phone', phone)
                .maybeSingle();
            
            if (!existing) {
                await supabaseAdmin
                    .from('user_stats')
                    .insert([{ phone: phone, order_count: 0, reject_count: 0, suspect_flag: false, blocked: false }]);
            }
            
            res.json({ success: true, message: 'Login successful' });
        } else {
            res.status(401).json({ success: false, error: 'Invalid or expired OTP' });
        }
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. Check Auth Status
app.get('/api/auth/status', (req, res) => {
    if (req.session.isAuthenticated && req.session.userPhone) {
        res.json({ authenticated: true, phone: req.session.userPhone });
    } else {
        res.json({ authenticated: false });
    }
});

// 4. Logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logged out' });
});

// ==================== BALANCE API (User Dashboard) ====================
app.get('/api/user/balance', async (req, res) => {
    if (!req.session.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    try {
        const balance = await getUserBalance(req.session.userPhone);
        res.json({ success: true, ...balance });
    } catch (error) {
        console.error('Balance error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== ORDER API ====================
app.get('/api/user/orders', async (req, res) => {
    if (!req.session.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('phone', req.session.userPhone)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        res.json({ success: true, orders: data || [] });
    } catch (error) {
        console.error('Orders error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/orders', upload.single('slip'), async (req, res) => {
    if (!req.session.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'Please login first' });
    }
    
    try {
        const { plan, price } = req.body;
        const phone = req.session.userPhone;
        const slipFile = req.file;
        
        if (!plan || !price) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        let slipUrl = null;
        let imageHash = null;
        
        if (slipFile) {
            slipUrl = `/uploads/${slipFile.filename}`;
            const fileBuffer = fs.readFileSync(slipFile.path);
            imageHash = crypto.createHash('md5').update(fileBuffer).digest('hex');
        }
        
        const orderId = Date.now();
        
        const { error } = await supabase
            .from('orders')
            .insert([{
                id: orderId,
                phone: phone,
                plan: plan,
                price: parseInt(price),
                status: 'Pending',
                slip_url: slipUrl,
                image_hash: imageHash
            }]);
        
        if (error) throw error;
        
        res.json({ success: true, orderId: orderId, message: 'Order created successfully' });
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== ADMIN API ====================
app.get('/api/admin/orders', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        res.json({ orders: data || [] });
    } catch (error) {
        res.status(500).json({ orders: [], error: error.message });
    }
});

app.get('/api/admin/user-stats', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('user_stats')
            .select('*')
            .order('order_count', { ascending: false });
        
        if (error) throw error;
        res.json({ stats: data || [] });
    } catch (error) {
        res.status(500).json({ stats: [], error: error.message });
    }
});

app.put('/api/admin/orders/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseAdmin
            .from('orders')
            .update({ status: 'Approved', activated_at: new Date().toISOString() })
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/admin/orders/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseAdmin
            .from('orders')
            .update({ status: 'Rejected' })
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/admin/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseAdmin
            .from('orders')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/user-block', async (req, res) => {
    try {
        const { phone, block } = req.body;
        const { error } = await supabaseAdmin
            .from('user_stats')
            .update({ blocked: block })
            .eq('phone', phone);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false });
    }
});

// ==================== STATIC ROUTES ====================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📱 Store: http://localhost:${PORT}/`);
    console.log(`👨‍💼 Admin: http://localhost:${PORT}/admin.html`);
});
