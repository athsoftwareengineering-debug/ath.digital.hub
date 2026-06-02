// server.js - RENDER FIXED VERSION
const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const session = require('express-session');
const { supabase, supabaseAdmin, saveOTP, verifyOTP } = require('./database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== IMPORTANT: Render Trust Proxy ====================
app.set('trust proxy', 1);

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Session configuration for Render
app.use(session({
    secret: process.env.SESSION_SECRET || 'mytel-secret-key-for-render',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'
    }
}));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static('uploads'));

// File upload config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ==================== HELPER FUNCTIONS ====================
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function convertToEnglish(input) {
    const myanmar = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];
    const english = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    let result = input;
    for (let i = 0; i < myanmar.length; i++) {
        result = result.replace(new RegExp(myanmar[i], 'g'), english[i]);
    }
    return result.replace(/\D/g, '');
}

// Send OTP (Log to console for Render)
async function sendOTP(phone, otp) {
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log(`║  📱 Phone: ${phone}`);
    console.log(`║  🔐 OTP CODE: ${otp}`);
    console.log(`║  ⏰ Valid for 5 minutes`);
    console.log(`║  💡 Enter this code in the website`);
    console.log('╚══════════════════════════════════════════════════════╝\n');
    return true;
}

// ==================== AUTH API ====================

// 1. Send OTP
app.post('/api/auth/send-otp', async (req, res) => {
    console.log('📨 Send OTP request received:', req.body);
    
    try {
        const { phone } = req.body;
        
        if (!phone || phone.length < 9) {
            console.log('❌ Invalid phone:', phone);
            return res.status(400).json({ success: false, error: 'ဖုန်းနံပါတ် မှန်ကန်စွာ ထည့်ပါ' });
        }
        
        let formattedPhone = phone;
        if (phone.startsWith('09')) {
            formattedPhone = phone;
        } else if (phone.startsWith('959')) {
            formattedPhone = '0' + phone.substring(2);
        }
        
        const otp = generateOTP();
        saveOTP(formattedPhone, otp);
        
        await sendOTP(formattedPhone, otp);
        
        console.log(`✅ OTP sent successfully for: ${formattedPhone}`);
        res.json({ 
            success: true, 
            message: 'OTP ကုဒ် ပို့ပြီးပါပြီ။ Render Logs မှာ OTP ကုဒ်ကို ကြည့်ပါ။' 
        });
        
    } catch (error) {
        console.error('❌ Send OTP error:', error);
        res.status(500).json({ success: false, error: 'Server error: ' + error.message });
    }
});

// 2. Verify OTP
app.post('/api/auth/verify-otp', async (req, res) => {
    console.log('🔐 Verify OTP request received:', req.body);
    
    try {
        let { phone, otp } = req.body;
        
        if (!phone || !otp) {
            return res.status(400).json({ success: false, error: 'ဖုန်းနံပါတ်နှင့် OTP ထည့်ပါ' });
        }
        
        const convertedOtp = convertToEnglish(otp);
        
        let formattedPhone = phone;
        if (phone.startsWith('09')) {
            formattedPhone = phone;
        } else if (phone.startsWith('959')) {
            formattedPhone = '0' + phone.substring(2);
        }
        
        console.log(`Verifying: ${formattedPhone} with OTP: ${convertedOtp}`);
        
        const isValid = verifyOTP(formattedPhone, convertedOtp);
        
        if (isValid) {
            req.session.userPhone = formattedPhone;
            req.session.isAuthenticated = true;
            
            // Create user if not exists
            try {
                const { data: existing } = await supabaseAdmin
                    .from('user_stats')
                    .select('phone')
                    .eq('phone', formattedPhone)
                    .maybeSingle();
                
                if (!existing) {
                    await supabaseAdmin
                        .from('user_stats')
                        .insert([{ 
                            phone: formattedPhone, 
                            order_count: 0, 
                            reject_count: 0, 
                            suspect_flag: false, 
                            blocked: false 
                        }]);
                }
            } catch (dbError) {
                console.error('DB error but continuing:', dbError.message);
            }
            
            console.log(`✅ Login successful: ${formattedPhone}`);
            res.json({ success: true, message: 'အကောင့်ဝင်ရောက်မှု အောင်မြင်ပါသည်' });
        } else {
            console.log(`❌ Invalid OTP for: ${formattedPhone}`);
            res.status(401).json({ 
                success: false, 
                error: 'OTP ကုဒ် မှားယွင်းနေပါသည်။ Render Logs ရှိ OTP ကုဒ်ကို ထည့်ပါ။' 
            });
        }
    } catch (error) {
        console.error('❌ Verify OTP error:', error);
        res.status(500).json({ success: false, error: 'Server error: ' + error.message });
    }
});

// 3. Check Auth Status
app.get('/api/auth/status', (req, res) => {
    try {
        if (req.session.isAuthenticated && req.session.userPhone) {
            res.json({ authenticated: true, phone: req.session.userPhone });
        } else {
            res.json({ authenticated: false });
        }
    } catch (error) {
        res.json({ authenticated: false });
    }
});

// 4. Logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'ထွက်ရန် အောင်မြင်ပါသည်' });
});

// ==================== BALANCE API ====================
app.get('/api/user/balance', async (req, res) => {
    if (!req.session.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'ကျေးဇူးပြု၍ အကောင့်ဝင်ပါ' });
    }
    
    try {
        const { data: orders } = await supabase
            .from('orders')
            .select('*')
            .eq('phone', req.session.userPhone)
            .eq('status', 'Approved');
        
        let totalDataMB = 26245; // Default like your image
        let totalMinutes = 0;
        
        const planMapping = {
            "VIP LEVEL - 1": { data: 22 * 1024, minutes: 8000 },
            "VIP LEVEL - 2": { data: 40 * 1024, minutes: 250 },
            "VIP LEVEL - 3": { data: 40 * 1024, minutes: 1400 },
            "VIP LEVEL - 4 (ULTRA)": { data: 120 * 1024, minutes: 0 }
        };
        
        if (orders && orders.length > 0) {
            totalDataMB = 0;
            for (const order of orders) {
                const plan = planMapping[order.plan];
                if (plan) {
                    totalDataMB += plan.data;
                    totalMinutes += plan.minutes;
                }
            }
        }
        
        res.json({
            success: true,
            balance: 0,
            minutes: totalMinutes,
            data: totalDataMB,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Balance error:', error);
        res.json({
            success: true,
            balance: 0,
            minutes: 0,
            data: 26245,
            lastUpdated: new Date().toISOString()
        });
    }
});

// ==================== ORDERS API ====================
app.get('/api/user/orders', async (req, res) => {
    if (!req.session.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'ကျေးဇူးပြု၍ အကောင့်ဝင်ပါ' });
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
        res.json({ success: true, orders: [] });
    }
});

app.post('/api/orders', upload.single('slip'), async (req, res) => {
    if (!req.session.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'ကျေးဇူးပြု၍ အကောင့်ဝင်ပါ' });
    }
    
    try {
        const { plan, price } = req.body;
        const phone = req.session.userPhone;
        const slipFile = req.file;
        
        if (!plan || !price) {
            return res.status(400).json({ success: false, error: 'အချက်အလက် မပြည့်စုံပါ' });
        }
        
        let slipUrl = slipFile ? `/uploads/${slipFile.filename}` : null;
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
                created_at: new Date().toISOString()
            }]);
        
        if (error) throw error;
        
        res.json({ success: true, orderId: orderId, message: 'အော်ဒါအောင်မြင်ပါသည်' });
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
        res.json({ orders: [] });
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
        res.json({ stats: [] });
    }
});

app.put('/api/admin/orders/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        await supabaseAdmin
            .from('orders')
            .update({ status: 'Approved', activated_at: new Date().toISOString() })
            .eq('id', id);
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false });
    }
});

app.put('/api/admin/orders/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        await supabaseAdmin
            .from('orders')
            .update({ status: 'Rejected' })
            .eq('id', id);
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false });
    }
});

app.delete('/api/admin/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await supabaseAdmin
            .from('orders')
            .delete()
            .eq('id', id);
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false });
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

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== STATIC ROUTES ====================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// ==================== START SERVER ====================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n╔════════════════════════════════════════════════════════════╗`);
    console.log(`║  🚀 Server Running on port ${PORT}                          ║`);
    console.log(`║  📱 Store: https://ath-digital-hub.onrender.com/           ║`);
    console.log(`║  💡 OTP will appear in Render Logs!                        ║`);
    console.log(`║  🔍 Check: https://dashboard.render.com/                   ║`);
    console.log(`╚════════════════════════════════════════════════════════════╝\n`);
});
