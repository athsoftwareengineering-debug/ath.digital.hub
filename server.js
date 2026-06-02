// server.js - WORKING VERSION with OTP in Terminal
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

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use(session({
    secret: 'mytel-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Uploads directory
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

// ==================== OTP FUNCTIONS - WORKING ====================

// Generate 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Convert Myanmar numbers to English
function convertToEnglish(input) {
    const myanmar = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];
    const english = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    let result = input;
    for (let i = 0; i < myanmar.length; i++) {
        result = result.replace(new RegExp(myanmar[i], 'g'), english[i]);
    }
    return result.replace(/\D/g, '');
}

// ✅ WORKING: OTP ကို Terminal မှာပြမယ် (SMS မပို့တော့ဘူး)
async function sendOTP(phone, otp) {
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log(`║  📱 ဖုန်းနံပါတ်: ${phone}`);
    console.log(`║  🔐 OTP ကုဒ်: ${otp}`);
    console.log(`║  ⏰ သက်တမ်း: 5 မိနစ်`);
    console.log(`║  💡 ဤ OTP ကုဒ်ကို ဝက်ဘ်ဆိုက်တွင် ထည့်ပါ။`);
    console.log('╚══════════════════════════════════════════════════════╝\n');
    return true;
}

// ==================== AUTH API ====================

// 1. Send OTP
app.post('/api/auth/send-otp', async (req, res) => {
    try {
        const { phone } = req.body;
        
        if (!phone || phone.length < 9) {
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
        
        res.json({ 
            success: true, 
            message: 'OTP ကုဒ် ပို့ပြီးပါပြီ။ Terminal တွင် OTP ကုဒ်ကို ကြည့်ပါ။' 
        });
        
    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// 2. Verify OTP
app.post('/api/auth/verify-otp', async (req, res) => {
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
        
        console.log(`\n🔐 Verifying OTP for: ${formattedPhone}`);
        console.log(`📝 Entered OTP: ${convertedOtp}`);
        
        const isValid = verifyOTP(formattedPhone, convertedOtp);
        
        if (isValid) {
            req.session.userPhone = formattedPhone;
            req.session.isAuthenticated = true;
            
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
            
            console.log(`✅ Login successful for: ${formattedPhone}\n`);
            res.json({ success: true, message: 'အကောင့်ဝင်ရောက်မှု အောင်မြင်ပါသည်' });
        } else {
            console.log(`❌ Invalid OTP for: ${formattedPhone}\n`);
            res.status(401).json({ 
                success: false, 
                error: 'OTP ကုဒ် မှားယွင်းနေပါသည်။ Terminal ရှိ OTP ကုဒ်ကို ထည့်ပါ။' 
            });
        }
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
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
        
        let totalDataMB = 0;
        let totalMinutes = 0;
        
        const planMapping = {
            "VIP LEVEL - 1": { data: 22 * 1024, minutes: 8000 },
            "VIP LEVEL - 2": { data: 40 * 1024, minutes: 250 },
            "VIP LEVEL - 3": { data: 40 * 1024, minutes: 1400 },
            "VIP LEVEL - 4 (ULTRA)": { data: 120 * 1024, minutes: 0 }
        };
        
        for (const order of orders) {
            const plan = planMapping[order.plan];
            if (plan) {
                totalDataMB += plan.data;
                totalMinutes += plan.minutes;
            }
        }
        
        res.json({
            success: true,
            balance: 0,
            minutes: totalMinutes,
            data: totalDataMB || 26245,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Balance error:', error);
        res.status(500).json({ success: false, error: error.message });
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
        res.status(500).json({ success: false, error: error.message });
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
        await supabaseAdmin
            .from('orders')
            .update({ status: 'Approved', activated_at: new Date().toISOString() })
            .eq('id', id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
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
        res.status(500).json({ success: false, error: error.message });
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
    console.log(`\n╔════════════════════════════════════════════════════════════╗`);
    console.log(`║  🚀 Server Running on http://localhost:${PORT}              ║`);
    console.log(`║  📱 Store: http://localhost:${PORT}/                        ║`);
    console.log(`║  👨‍💼 Admin: http://localhost:${PORT}/admin.html              ║`);
    console.log(`║  📱 OTP Mode: Terminal (SMS မပို့တော့ပါ)                   ║`);
    console.log(`║  💡 OTP ကုဒ်ကို Terminal မှာ ကြည့်ပါ။                    ║`);
    console.log(`╚════════════════════════════════════════════════════════════╝\n`);
});
