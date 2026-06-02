// server.js - MYTEL REAL API VERSION (Render Ready)
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

// Trust proxy for Render
app.set('trust proxy', 1);

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'mytel-real-api-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'
    }
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

// ==================== MYTEL REAL API FUNCTIONS ====================

const MYTEL_API_BASE = process.env.MYTEL_API_BASE || 'https://apis.mytel.com.mm/myid/authen/v1.0';

function generateDeviceId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 8);
}

function getMytelHeaders() {
    return {
        'host': 'apis.mytel.com.mm',
        'accept-language': 'en',
        'accept-encoding': 'gzip',
        'user-agent': 'okhttp/4.12.0',
        'content-type': 'application/json; charset=UTF-8'
    };
}

// 1. Check Account
async function checkMytelAccount(phone) {
    try {
        const url = `${MYTEL_API_BASE}/login/action/check-account?phoneNumber=${phone}`;
        console.log(`📡 Checking account: ${url}`);
        const response = await axios.get(url, { 
            headers: getMytelHeaders(), 
            timeout: 15000,
            // Important: Don't follow redirects, handle real response
            maxRedirects: 0,
            validateStatus: status => status < 500
        });
        console.log(`📡 Check account response:`, response.status, response.data);
        return response.data;
    } catch (error) {
        console.error('Check Account Error:', error.response?.status, error.response?.data || error.message);
        return { errorCode: error.response?.status || 500, message: error.message };
    }
}

// 2. Send OTP (REAL SMS)
async function sendMytelOTP(phone) {
    try {
        const url = `${MYTEL_API_BASE}/login/method/otp/get-otp?phoneNumber=${phone}`;
        console.log(`📡 Sending OTP request: ${url}`);
        const response = await axios.get(url, { 
            headers: getMytelHeaders(), 
            timeout: 20000,
            maxRedirects: 0,
            validateStatus: status => status < 500
        });
        console.log(`📡 Send OTP response:`, response.status, response.data);
        return response.data;
    } catch (error) {
        console.error('Send OTP Error:', error.response?.status, error.response?.data || error.message);
        return { errorCode: error.response?.status || 500, message: error.message };
    }
}

// 3. Validate OTP
async function validateMytelOTP(phone, otp, deviceId) {
    try {
        const url = `${MYTEL_API_BASE}/login/method/otp/validate-otp`;
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
        
        console.log(`📡 Validating OTP for: ${phone}`);
        const response = await axios.post(url, payload, { 
            headers: getMytelHeaders(), 
            timeout: 15000,
            maxRedirects: 0
        });
        
        console.log(`📡 Validate response:`, response.status, response.data);
        
        if (response.data && response.data.errorCode === 200) {
            return { 
                success: true, 
                token: response.data.result?.access_token || response.data.result?.thirdPartyToken 
            };
        } else {
            return { success: false, error: response.data?.message || 'Invalid OTP' };
        }
    } catch (error) {
        console.error('Validate OTP Error:', error.response?.status, error.response?.data || error.message);
        return { success: false, error: error.message };
    }
}

// Convert Myanmar numbers to English
function convertToEnglishNumbers(input) {
    const myanmarNumbers = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];
    const englishNumbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    let result = input;
    for (let i = 0; i < myanmarNumbers.length; i++) {
        result = result.replace(new RegExp(myanmarNumbers[i], 'g'), englishNumbers[i]);
    }
    return result.replace(/\D/g, '');
}

// ==================== AUTH API ====================

// 1. Send OTP
app.post('/api/auth/send-otp', async (req, res) => {
    console.log('\n========================================');
    console.log('📨 POST /api/auth/send-otp');
    console.log('Request body:', req.body);
    console.log('========================================\n');
    
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
        
        console.log(`📞 Target phone: ${formattedPhone}`);
        
        // Step 1: Check account
        const checkResult = await checkMytelAccount(formattedPhone);
        console.log('✅ Account check result:', JSON.stringify(checkResult));
        
        // Step 2: Send OTP
        const otpResult = await sendMytelOTP(formattedPhone);
        console.log('✅ Send OTP result:', JSON.stringify(otpResult));
        
        if (otpResult.errorCode === 200) {
            // Store local OTP for fallback verification
            const localOTP = Math.floor(100000 + Math.random() * 900000).toString();
            saveOTP(formattedPhone, localOTP);
            
            res.json({ 
                success: true, 
                message: 'OTP ကုဒ် ပို့ပြီးပါပြီ။ သင့် SMS ကို စစ်ဆေးပါ။',
                debug: { otpSent: true, apiResponse: otpResult.message }
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: otpResult.message || 'OTP ပို့ရန် မအောင်မြင်ပါ။ ကျေးဇူးပြု၍ နောက်မှကြိုးစားပါ။',
                debug: { apiResponse: otpResult }
            });
        }
    } catch (error) {
        console.error('❌ Send OTP error:', error);
        res.status(500).json({ success: false, error: 'Server error: ' + error.message });
    }
});

// 2. Verify OTP
app.post('/api/auth/verify-otp', async (req, res) => {
    console.log('\n========================================');
    console.log('🔐 POST /api/auth/verify-otp');
    console.log('Request body:', req.body);
    console.log('========================================\n');
    
    try {
        let { phone, otp } = req.body;
        
        if (!phone || !otp) {
            return res.status(400).json({ success: false, error: 'ဖုန်းနံပါတ်နှင့် OTP ထည့်ပါ' });
        }
        
        const convertedOtp = convertToEnglishNumbers(otp);
        
        let formattedPhone = phone;
        if (phone.startsWith('09')) {
            formattedPhone = phone;
        } else if (phone.startsWith('959')) {
            formattedPhone = '0' + phone.substring(2);
        }
        
        console.log(`🔐 Phone: ${formattedPhone}, OTP: ${convertedOtp}`);
        
        const deviceId = generateDeviceId();
        const validation = await validateMytelOTP(formattedPhone, convertedOtp, deviceId);
        
        console.log('Validation result:', validation);
        
        if (validation.success) {
            req.session.userPhone = formattedPhone;
            req.session.isAuthenticated = true;
            req.session.mytelToken = validation.token;
            
            // Create user in DB
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
            
            console.log(`✅ Login successful: ${formattedPhone}`);
            res.json({ success: true, message: 'အကောင့်ဝင်ရောက်မှု အောင်မြင်ပါသည်' });
        } else {
            // Try local fallback
            const isValidLocal = verifyOTP(formattedPhone, convertedOtp);
            if (isValidLocal) {
                req.session.userPhone = formattedPhone;
                req.session.isAuthenticated = true;
                console.log(`✅ Login successful (local fallback): ${formattedPhone}`);
                res.json({ success: true, message: 'အကောင့်ဝင်ရောက်မှု အောင်မြင်ပါသည်' });
            } else {
                console.log(`❌ Invalid OTP: ${formattedPhone}`);
                res.status(401).json({ 
                    success: false, 
                    error: 'OTP ကုဒ် မှားယွင်းနေပါသည်။ အင်္ဂလိပ်ဂဏန်းများဖြင့် ထည့်သွင်းပါ။' 
                });
            }
        }
    } catch (error) {
        console.error('❌ Verify OTP error:', error);
        res.status(500).json({ success: false, error: 'Server error: ' + error.message });
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
        
        let totalDataMB = 26245;
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
        res.json({ success: true, balance: 0, minutes: 0, data: 26245 });
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
        await supabaseAdmin
            .from('orders')
            .update({ status: 'Approved', activated_at: new Date().toISOString() })
            .eq('id', req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false });
    }
});

app.put('/api/admin/orders/:id/reject', async (req, res) => {
    try {
        await supabaseAdmin
            .from('orders')
            .update({ status: 'Rejected' })
            .eq('id', req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false });
    }
});

app.delete('/api/admin/orders/:id', async (req, res) => {
    try {
        await supabaseAdmin
            .from('orders')
            .delete()
            .eq('id', req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false });
    }
});

app.post('/api/admin/login', (req, res) => {
    if (req.body.password === process.env.ADMIN_PASSWORD) {
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
    console.log(`║  🚀 MYTEL REAL API SERVER                                ║`);
    console.log(`║  📡 API Base: ${MYTEL_API_BASE}`);
    console.log(`║  📱 Store: https://ath-digital-hub.onrender.com/         ║`);
    console.log(`║  💡 REAL SMS will be sent to your phone!                 ║`);
    console.log(`║  🔍 Check Render Logs for details                        ║`);
    console.log(`╚════════════════════════════════════════════════════════════╝\n`);
});
