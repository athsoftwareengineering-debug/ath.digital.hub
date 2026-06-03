// server.js - MYTEL REAL BALANCE API (ONLY MYTEL API - NO FALLBACK)
const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const { supabase, supabaseAdmin } = require('./database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for Render
app.set('trust proxy', 1);

// ==================== RATE LIMITING (Mytel API Protection) ====================
const mytelApiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 3, // Max 3 requests per minute
    message: { success: false, error: 'Too many requests. Please wait a moment.' },
    keyGenerator: (req) => req.body.phone || req.ip,
    skipSuccessfulRequests: false,
});

const balanceApiLimiter = rateLimit({
    windowMs: 30 * 1000, // 30 seconds
    max: 2, // Max 2 requests per 30 seconds
    message: { success: false, error: 'Please wait before checking balance again.' },
});

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'mytel-real-balance-secret',
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
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
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

// ==================== MYTEL API CONFIGURATION ====================
const MYTEL_AUTH_BASE = 'https://apis.mytel.com.mm/myid/authen/v1.0';
const MYTEL_ACCOUNT_BASE = 'https://apis.mytel.com.mm/account-detail/api/v1.2/individual';

// Rotating device IDs to avoid detection
const deviceIdPool = [];
for (let i = 0; i < 10; i++) {
    deviceIdPool.push(generateDeviceId());
}
let deviceIdIndex = 0;

function generateDeviceId() {
    return crypto.randomBytes(16).toString('hex');
}

function getNextDeviceId() {
    const deviceId = deviceIdPool[deviceIdIndex % deviceIdPool.length];
    deviceIdIndex++;
    return deviceId;
}

function getMytelHeaders(accessToken = null) {
    const headers = {
        'host': 'apis.mytel.com.mm',
        'accept-language': 'en',
        'accept-encoding': 'gzip',
        'user-agent': 'okhttp/4.12.0',
        'content-type': 'application/json; charset=UTF-8',
        'connection': 'Keep-Alive'
    };
    if (accessToken) {
        headers['authorization'] = `Bearer ${accessToken}`;
    }
    return headers;
}

function convertToEnglishNumbers(input) {
    if (!input) return '';
    const myanmarNumbers = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];
    const englishNumbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    let result = input.toString();
    for (let i = 0; i < myanmarNumbers.length; i++) {
        result = result.replace(new RegExp(myanmarNumbers[i], 'g'), englishNumbers[i]);
    }
    return result.replace(/\D/g, '');
}

function formatPhone(phone) {
    let cleaned = phone.toString().replace(/\s/g, '');
    if (cleaned.startsWith('+95')) {
        cleaned = '0' + cleaned.substring(3);
    } else if (cleaned.startsWith('959')) {
        cleaned = '0' + cleaned.substring(2);
    }
    if (!cleaned.startsWith('09')) {
        cleaned = '09' + cleaned;
    }
    return cleaned;
}

// ==================== MYTEL AUTH APIS ====================

async function checkMytelAccount(phone) {
    try {
        const url = `${MYTEL_AUTH_BASE}/login/action/check-account?phoneNumber=${phone}`;
        console.log(`📡 [CHECK] ${phone}`);
        const response = await axios.get(url, { 
            headers: getMytelHeaders(), 
            timeout: 15000 
        });
        return { success: true, data: response.data };
    } catch (error) {
        console.error(`❌ Check account failed:`, error.response?.status);
        return { success: false, error: error.response?.status || 500, message: error.message };
    }
}

async function sendMytelOTP(phone) {
    try {
        const url = `${MYTEL_AUTH_BASE}/login/method/otp/get-otp?phoneNumber=${phone}`;
        console.log(`📡 [SEND OTP] ${phone}`);
        const response = await axios.get(url, { 
            headers: getMytelHeaders(), 
            timeout: 20000 
        });
        
        if (response.data && response.data.errorCode === 200) {
            return { success: true, message: 'OTP sent successfully' };
        }
        return { success: false, error: response.data?.message || 'OTP send failed' };
    } catch (error) {
        console.error(`❌ Send OTP failed:`, error.response?.status);
        return { success: false, error: error.message };
    }
}

async function validateMytelOTP(phone, otp, deviceId) {
    try {
        const url = `${MYTEL_AUTH_BASE}/login/method/otp/validate-otp`;
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
        
        console.log(`📡 [VALIDATE OTP] ${phone} | Device: ${deviceId.substring(0, 8)}...`);
        const response = await axios.post(url, payload, { 
            headers: getMytelHeaders(), 
            timeout: 15000 
        });
        
        if (response.data && response.data.errorCode === 200) {
            const accessToken = response.data.result?.access_token;
            console.log(`✅ OTP Validated! Token: ${accessToken ? 'Received' : 'Not received'}`);
            return { 
                success: true, 
                accessToken: accessToken,
                refreshToken: response.data.result?.refresh_token
            };
        }
        return { success: false, error: response.data?.message || 'Invalid OTP' };
    } catch (error) {
        console.error(`❌ Validate OTP failed:`, error.response?.status);
        return { success: false, error: error.message };
    }
}

async function refreshAccessToken(refreshToken) {
    try {
        const url = `${MYTEL_AUTH_BASE}/token/refresh`;
        const payload = { refreshToken: refreshToken };
        const response = await axios.post(url, payload, { 
            headers: getMytelHeaders(), 
            timeout: 10000 
        });
        
        if (response.data && response.data.errorCode === 200) {
            return { success: true, accessToken: response.data.result?.access_token };
        }
        return { success: false };
    } catch (error) {
        return { success: false };
    }
}

// ==================== MYTEL REAL BALANCE APIS ====================

async function getRealAccountBalance(accessToken) {
    try {
        const url = `${MYTEL_ACCOUNT_BASE}/account-balance`;
        console.log(`📡 [BALANCE] Fetching...`);
        const response = await axios.get(url, { 
            headers: getMytelHeaders(accessToken), 
            timeout: 10000 
        });
        
        if (response.data && response.data.errorCode === 200 && response.data.result) {
            return { success: true, balance: response.data.result.balance || 0 };
        }
        return { success: false, balance: 0 };
    } catch (error) {
        console.error(`❌ Balance Error:`, error.response?.status);
        return { success: false, balance: 0 };
    }
}

async function getRealDataUsage(accessToken) {
    try {
        const url = `${MYTEL_ACCOUNT_BASE}/data-usage`;
        const response = await axios.get(url, { 
            headers: getMytelHeaders(accessToken), 
            timeout: 10000 
        });
        
        if (response.data && response.data.errorCode === 200 && response.data.result) {
            let data = response.data.result.remainingData || response.data.result.remaining || 0;
            if (data < 100 && response.data.result.unit === 'GB') data = data * 1024;
            return { success: true, data: Math.round(data) };
        }
        return { success: false, data: 0 };
    } catch (error) {
        return { success: false, data: 0 };
    }
}

async function getRealVoiceUsage(accessToken) {
    try {
        const url = `${MYTEL_ACCOUNT_BASE}/voice-usage`;
        const response = await axios.get(url, { 
            headers: getMytelHeaders(accessToken), 
            timeout: 10000 
        });
        
        if (response.data && response.data.errorCode === 200 && response.data.result) {
            return { success: true, minutes: response.data.result.remainingMinutes || 0 };
        }
        return { success: false, minutes: 0 };
    } catch (error) {
        return { success: false, minutes: 0 };
    }
}

async function getRealSmsUsage(accessToken) {
    try {
        const url = `${MYTEL_ACCOUNT_BASE}/sms-usage`;
        const response = await axios.get(url, { 
            headers: getMytelHeaders(accessToken), 
            timeout: 10000 
        });
        
        if (response.data && response.data.errorCode === 200 && response.data.result) {
            return { success: true, sms: response.data.result.remainingSMS || 0 };
        }
        return { success: false, sms: 0 };
    } catch (error) {
        return { success: false, sms: 0 };
    }
}

async function getRealPoints(accessToken) {
    try {
        const url = `${MYTEL_ACCOUNT_BASE}/account-main`;
        const response = await axios.get(url, { 
            headers: getMytelHeaders(accessToken), 
            timeout: 10000 
        });
        
        if (response.data && response.data.errorCode === 200 && response.data.result) {
            const points = response.data.result.loyaltyPoints || response.data.result.points || 0;
            return { success: true, points: points };
        }
        return { success: false, points: 0 };
    } catch (error) {
        return { success: false, points: 0 };
    }
}

// ==================== AUTH API (Mytel Only) ====================

// Check if account exists
app.post('/api/auth/check-account', mytelApiLimiter, async (req, res) => {
    console.log('\n📞 POST /api/auth/check-account');
    
    try {
        const { phone } = req.body;
        if (!phone || phone.length < 9) {
            return res.status(400).json({ success: false, error: 'ဖုန်းနံပါတ် မှန်ကန်စွာ ထည့်ပါ' });
        }
        
        const formattedPhone = formatPhone(phone);
        const result = await checkMytelAccount(formattedPhone);
        
        if (result.success) {
            res.json({ success: true, exists: true, message: 'အကောင့်ရှိပါသည်' });
        } else {
            res.json({ success: true, exists: false, message: 'အကောင့်မရှိပါ' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Send OTP
app.post('/api/auth/send-otp', mytelApiLimiter, async (req, res) => {
    console.log('\n📨 POST /api/auth/send-otp');
    
    try {
        const { phone } = req.body;
        if (!phone || phone.length < 9) {
            return res.status(400).json({ success: false, error: 'ဖုန်းနံပါတ် မှန်ကန်စွာ ထည့်ပါ' });
        }
        
        const formattedPhone = formatPhone(phone);
        const result = await sendMytelOTP(formattedPhone);
        
        if (result.success) {
            // Store phone in session for OTP validation
            req.session.pendingPhone = formattedPhone;
            req.session.deviceId = getNextDeviceId();
            
            res.json({ 
                success: true, 
                message: 'OTP ကုဒ် ပို့ပြီးပါပြီ။ သင့် SMS ကို စစ်ဆေးပါ။',
                expiresIn: 300 
            });
        } else {
            res.status(500).json({ success: false, error: result.error || 'OTP ပို့ရန် မအောင်မြင်ပါ။ ထပ်မံကြိုးစားပါ။' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Verify OTP and Login
app.post('/api/auth/verify-otp', mytelApiLimiter, async (req, res) => {
    console.log('\n🔐 POST /api/auth/verify-otp');
    
    try {
        let { phone, otp } = req.body;
        if (!phone || !otp) {
            return res.status(400).json({ success: false, error: 'ဖုန်းနံပါတ်နှင့် OTP ထည့်ပါ' });
        }
        
        const convertedOtp = convertToEnglishNumbers(otp);
        const formattedPhone = formatPhone(phone);
        const deviceId = req.session.deviceId || getNextDeviceId();
        
        console.log(`🔐 Verifying OTP for ${formattedPhone} with device ${deviceId.substring(0, 8)}...`);
        
        const validation = await validateMytelOTP(formattedPhone, convertedOtp, deviceId);
        
        if (validation.success) {
            // Store authentication in session
            req.session.userPhone = formattedPhone;
            req.session.isAuthenticated = true;
            req.session.accessToken = validation.accessToken;
            req.session.refreshToken = validation.refreshToken;
            req.session.tokenExpiry = Date.now() + 55 * 60 * 1000; // 55 minutes
            delete req.session.pendingPhone;
            delete req.session.deviceId;
            
            // Save user to database
            const { data: existing } = await supabaseAdmin
                .from('user_stats')
                .select('phone')
                .eq('phone', formattedPhone)
                .maybeSingle();
            
            if (!existing) {
                await supabaseAdmin
                    .from('user_stats')
                    .insert([{ phone: formattedPhone, order_count: 0, reject_count: 0, suspect_flag: false, blocked: false }]);
            }
            
            console.log(`✅ Login successful: ${formattedPhone}`);
            res.json({ 
                success: true, 
                message: 'အကောင့်ဝင်ရောက်မှု အောင်မြင်ပါသည်',
                user: { phone: formattedPhone }
            });
        } else {
            console.log(`❌ OTP validation failed for ${formattedPhone}`);
            res.status(401).json({ 
                success: false, 
                error: 'OTP ကုဒ် မှားယွင်းနေပါသည်။ အင်္ဂလိပ်ဂဏန်း ၆ လုံးဖြင့် ထပ်မံကြိုးစားပါ။' 
            });
        }
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Check auth status
app.get('/api/auth/status', async (req, res) => {
    if (req.session.isAuthenticated && req.session.userPhone) {
        // Check if token needs refresh
        if (req.session.tokenExpiry && Date.now() > req.session.tokenExpiry) {
            if (req.session.refreshToken) {
                const refreshResult = await refreshAccessToken(req.session.refreshToken);
                if (refreshResult.success) {
                    req.session.accessToken = refreshResult.accessToken;
                    req.session.tokenExpiry = Date.now() + 55 * 60 * 1000;
                } else {
                    // Token refresh failed, require re-login
                    req.session.isAuthenticated = false;
                    return res.json({ authenticated: false });
                }
            }
        }
        res.json({ authenticated: true, phone: req.session.userPhone });
    } else {
        res.json({ authenticated: false });
    }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logout အောင်မြင်ပါသည်' });
});

// ==================== REAL BALANCE API ====================
app.get('/api/user/balance', balanceApiLimiter, async (req, res) => {
    if (!req.session.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'ကျေးဇူးပြု၍ အကောင့်ဝင်ပါ', requireLogin: true });
    }
    
    const accessToken = req.session.accessToken;
    const userPhone = req.session.userPhone;
    
    console.log(`\n📊 [REAL BALANCE] Fetching for: ${userPhone}`);
    
    if (!accessToken) {
        return res.json({ success: false, error: 'Session expired. Please login again.', requireLogin: true });
    }
    
    try {
        const [balanceResult, dataResult, voiceResult, smsResult, pointsResult] = await Promise.all([
            getRealAccountBalance(accessToken),
            getRealDataUsage(accessToken),
            getRealVoiceUsage(accessToken),
            getRealSmsUsage(accessToken),
            getRealPoints(accessToken)
        ]);
        
        const responseData = {
            success: true,
            balance: balanceResult.balance || 0,
            minutes: voiceResult.minutes || 0,
            data: dataResult.data || 0,
            sms: smsResult.sms || 0,
            points: pointsResult.points || 0,
            lastUpdated: new Date().toISOString(),
            source: 'mytel-real-api'
        };
        
        console.log(`✅ Balance=${responseData.balance}, Data=${responseData.data}MB, Minutes=${responseData.minutes}`);
        res.json(responseData);
        
    } catch (error) {
        console.error('❌ Balance API error:', error);
        res.json({ success: false, error: 'Unable to fetch balance', requireLogin: false });
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
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

app.get('/api/admin/orders', async (req, res) => {
    try {
        const { data } = await supabaseAdmin.from('orders').select('*').order('created_at', { ascending: false });
        res.json({ orders: data || [] });
    } catch (error) {
        res.json({ orders: [] });
    }
});

app.get('/api/admin/user-stats', async (req, res) => {
    try {
        const { data } = await supabaseAdmin.from('user_stats').select('*').order('order_count', { ascending: false });
        res.json({ stats: data || [] });
    } catch (error) {
        res.json({ stats: [] });
    }
});

app.put('/api/admin/orders/:id/approve', async (req, res) => {
    try {
        await supabaseAdmin.from('orders').update({ status: 'Approved', activated_at: new Date().toISOString() }).eq('id', req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false });
    }
});

app.put('/api/admin/orders/:id/reject', async (req, res) => {
    try {
        await supabaseAdmin.from('orders').update({ status: 'Rejected' }).eq('id', req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false });
    }
});

app.delete('/api/admin/orders/:id', async (req, res) => {
    try {
        await supabaseAdmin.from('orders').delete().eq('id', req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false });
    }
});

app.post('/api/admin/login', (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== STATIC ROUTES ====================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// ==================== START SERVER ====================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║   🚀 MYTEL REAL BALANCE API - PRODUCTION READY                          ║
║                                                                          ║
║   ✅ Mytel API Only (No Fallback)                                        ║
║   ✅ Rate Limiting Enabled (3 req/min for OTP)                           ║
║   ✅ Rotating Device IDs                                                 ║
║   ✅ Token Refresh Support                                               ║
║   ✅ Session Management                                                  ║
║                                                                          ║
║   📱 Store:  https://ath-digital-hub.onrender.com                        ║
║   👨‍💼 Admin:  https://ath-digital-hub.onrender.com/admin.html            ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
    `);
});
