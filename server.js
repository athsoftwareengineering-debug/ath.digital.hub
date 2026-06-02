// server.js - Using Mytel Private API for OTP
const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
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
    secret: 'mytel-private-api-secret',
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

// ==================== MYTEL PRIVATE API FUNCTIONS ====================

// Generate random device ID (like mobile app)
function generateDeviceId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 8);
}

// Headers for Mytel API (mimicking mobile app)
function getMytelHeaders() {
    return {
        'host': 'apis.mytel.com.mm',
        'accept-language': 'en',
        'accept-encoding': 'gzip',
        'user-agent': 'okhttp/4.12.0',
        'content-type': 'application/json; charset=UTF-8'
    };
}

// 1. Check Account - Verify if phone number exists in Mytel
async function checkMytelAccount(phone) {
    try {
        const url = `${process.env.MYTEL_API_BASE}/login/action/check-account?phoneNumber=${phone}`;
        const response = await axios.get(url, { headers: getMytelHeaders(), timeout: 10000 });
        console.log(`📞 Check Account Response:`, response.data);
        return response.data;
    } catch (error) {
        console.error('Check Account Error:', error.response?.data || error.message);
        return { success: false, error: error.message };
    }
}

// 2. Get OTP via Mytel API (This actually sends SMS!)
async function sendMytelOTP(phone) {
    try {
        const url = `${process.env.MYTEL_API_BASE}/login/method/otp/get-otp?phoneNumber=${phone}`;
        const response = await axios.get(url, { 
            headers: getMytelHeaders(), 
            timeout: 15000 
        });
        console.log(`📱 Mytel OTP Response:`, response.data);
        
        // Check if OTP was sent successfully
        if (response.data && response.data.code === '00') {
            return { success: true, message: 'OTP sent successfully via Mytel' };
        } else {
            return { success: false, error: response.data?.message || 'Failed to send OTP' };
        }
    } catch (error) {
        console.error('Send OTP Error:', error.response?.data || error.message);
        return { success: false, error: error.response?.data?.message || error.message };
    }
}

// 3. Validate OTP with Mytel API
async function validateMytelOTP(phone, otp, deviceId) {
    try {
        const url = `${process.env.MYTEL_API_BASE}/login/method/otp/validate-otp`;
        const payload = {
            appVersion: "2.0.16",
            buildVersionApp: "300",
            deviceId: deviceId,
            imei: deviceId,
            os: "ANDROID",
            osApp: "ANDROID",
            password: otp,
            phoneNumber: phone,
            version: "8.1"
        };
        
        const response = await axios.post(url, payload, { 
            headers: getMytelHeaders(), 
            timeout: 15000 
        });
        console.log(`✅ Mytel Validate Response:`, response.data);
        
        if (response.data && (response.data.code === '00' || response.data.success)) {
            return { success: true, token: response.data.token || response.data.accessToken };
        } else {
            return { success: false, error: response.data?.message || 'Invalid OTP' };
        }
    } catch (error) {
        console.error('Validate OTP Error:', error.response?.data || error.message);
        return { success: false, error: error.response?.data?.message || 'OTP validation failed' };
    }
}

// Generate 6-digit OTP (for local storage)
function generateLocalOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ==================== AUTH API ====================

// 1. Send OTP using Mytel Private API
app.post('/api/auth/send-otp', async (req, res) => {
    try {
        const { phone } = req.body;
        
        if (!phone || phone.length < 9) {
            return res.status(400).json({ success: false, error: 'ဖုန်းနံပါတ် မှန်ကန်စွာ ထည့်ပါ' });
        }
        
        // Format phone number (remove +95 or 09)
        let formattedPhone = phone;
        if (phone.startsWith('09')) {
            formattedPhone = phone;
        } else if (phone.startsWith('959')) {
            formattedPhone = '0' + phone.substring(2);
        }
        
        console.log(`\n========================================`);
        console.log(`📱 Sending OTP to: ${formattedPhone}`);
        console.log(`========================================\n`);
        
        // Step 1: Check if account exists
        const checkResult = await checkMytelAccount(formattedPhone);
        console.log(`Account check result:`, checkResult);
        
        // Step 2: Send OTP via Mytel API
        const result = await sendMytelOTP(formattedPhone);
        
        if (result.success) {
            // Generate local OTP for verification storage
            const localOTP = generateLocalOTP();
            saveOTP(formattedPhone, localOTP);
            console.log(`🔐 Local OTP stored: ${localOTP} (for fallback)`);
            
            res.json({ 
                success: true, 
                message: 'OTP ကုဒ် ပို့ပြီးပါပြီ။ သင့် SMS ကို စစ်ဆေးပါ။' 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: result.error || 'OTP ပို့ရန် မအောင်မြင်ပါ။ ကျေးဇူးပြု၍ နောက်မှကြိုးစားပါ။' 
            });
        }
    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({ success: false, error: 'Server error. Please try again.' });
    }
});

// 2. Verify OTP using Mytel Private API
app.post('/api/auth/verify-otp', async (req, res) => {
    try {
        const { phone, otp } = req.body;
        
        if (!phone || !otp) {
            return res.status(400).json({ success: false, error: 'ဖုန်းနံပါတ်နှင့် OTP ထည့်ပါ' });
        }
        
        let formattedPhone = phone;
        if (phone.startsWith('09')) {
            formattedPhone = phone;
        } else if (phone.startsWith('959')) {
            formattedPhone = '0' + phone.substring(2);
        }
        
        console.log(`\n========================================`);
        console.log(`🔐 Verifying OTP for: ${formattedPhone}`);
        console.log(`📝 Entered OTP: ${otp}`);
        console.log(`========================================\n`);
        
        // Generate device ID (like mobile app)
        const deviceId = generateDeviceId();
        
        // Validate OTP with Mytel API
        const validation = await validateMytelOTP(formattedPhone, otp, deviceId);
        
        if (validation.success) {
            // Login successful
            req.session.userPhone = formattedPhone;
            req.session.isAuthenticated = true;
            req.session.deviceId = deviceId;
            req.session.mytelToken = validation.token;
            
            // Check if user exists in DB
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
            
            console.log(`✅ Login successful for: ${formattedPhone}`);
            res.json({ success: true, message: 'အကောင့်ဝင်ရောက်မှု အောင်မြင်ပါသည်' });
        } else {
            // Try local OTP verification as fallback
            const isValidLocal = verifyOTP(formattedPhone, otp);
            
            if (isValidLocal) {
                req.session.userPhone = formattedPhone;
                req.session.isAuthenticated = true;
                req.session.deviceId = generateDeviceId();
                
                console.log(`✅ Login successful (local fallback) for: ${formattedPhone}`);
                res.json({ success: true, message: 'အကောင့်ဝင်ရောက်မှု အောင်မြင်ပါသည်' });
            } else {
                console.log(`❌ Invalid OTP for: ${formattedPhone}`);
                res.status(401).json({ 
                    success: false, 
                    error: 'OTP ကုဒ် မှားယွင်းနေပါသည် သို့မဟုတ် သက်တမ်းကုန်ဆုံးသွားပါပြီ' 
                });
            }
        }
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ success: false, error: 'Server error. Please try again.' });
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
        // Get user's approved orders
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
            data: totalDataMB || 26245, // Show 26245 MB if no orders (like your image)
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Balance error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== USER ORDERS API ====================
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

// Create Order
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
                image_hash: imageHash,
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
    console.log(`║  ⚠️  Using Mytel Private API (apis.mytel.com.mm)            ║`);
    console.log(`║  📱 Real SMS will be sent to your phone!                    ║`);
    console.log(`║  ⚠️  This may cause IP ban. Use at your own risk!           ║`);
    console.log(`╚════════════════════════════════════════════════════════════╝\n`);
});
