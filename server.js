// server.js - MYTEL REAL API (Balance, Data, Minutes, SMS, Points)
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

// ==================== MYTEL REAL API FUNCTIONS ====================

const MYTEL_API_BASE = process.env.MYTEL_API_BASE || 'https://apis.mytel.com.mm';

function generateDeviceId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 8);
}

function getMytelHeaders(accessToken = null) {
    const headers = {
        'host': 'apis.mytel.com.mm',
        'accept-language': 'en',
        'accept-encoding': 'gzip',
        'user-agent': 'okhttp/4.12.0',
        'content-type': 'application/json; charset=UTF-8'
    };
    if (accessToken) {
        headers['authorization'] = `Bearer ${accessToken}`;
    }
    return headers;
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

// ==================== AUTH APIS ====================

async function checkMytelAccount(phone) {
    try {
        const url = `${MYTEL_API_BASE}/myid/authen/v1.0/login/action/check-account?phoneNumber=${phone}`;
        const response = await axios.get(url, { headers: getMytelHeaders(), timeout: 15000 });
        return response.data;
    } catch (error) {
        return { errorCode: 500, message: error.message };
    }
}

async function sendMytelOTP(phone) {
    try {
        const url = `${MYTEL_API_BASE}/myid/authen/v1.0/login/method/otp/get-otp?phoneNumber=${phone}`;
        const response = await axios.get(url, { headers: getMytelHeaders(), timeout: 20000 });
        return response.data;
    } catch (error) {
        return { errorCode: 500, message: error.message };
    }
}

async function validateMytelOTP(phone, otp, deviceId) {
    try {
        const url = `${MYTEL_API_BASE}/myid/authen/v1.0/login/method/otp/validate-otp`;
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
        
        const response = await axios.post(url, payload, { headers: getMytelHeaders(), timeout: 15000 });
        
        if (response.data && response.data.errorCode === 200) {
            return { 
                success: true, 
                accessToken: response.data.result?.access_token,
                refreshToken: response.data.result?.refresh_token
            };
        }
        return { success: false, error: response.data?.message };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ==================== REAL BALANCE APIS ====================

// 1. Account Balance (ဘေလ်လက်ကျန်)
async function getRealAccountBalance(accessToken) {
    try {
        const url = `${MYTEL_API_BASE}/account-detail/api/v1.2/individual/account-balance`;
        const response = await axios.get(url, { headers: getMytelHeaders(accessToken), timeout: 10000 });
        
        if (response.data && response.data.errorCode === 200 && response.data.result) {
            return {
                success: true,
                balance: response.data.result.balance || response.data.result.remainingBalance || 0,
                currency: response.data.result.currency || 'MMK'
            };
        }
        return { success: false, balance: 0 };
    } catch (error) {
        return { success: false, balance: 0 };
    }
}

// 2. Data Usage (ဒေတာလက်ကျန်)
async function getRealDataUsage(accessToken) {
    try {
        const url = `${MYTEL_API_BASE}/account-detail/api/v1.2/individual/data-usage`;
        const response = await axios.get(url, { headers: getMytelHeaders(accessToken), timeout: 10000 });
        
        if (response.data && response.data.errorCode === 200 && response.data.result) {
            let remainingData = 0;
            const result = response.data.result;
            
            if (result.remainingData) remainingData = result.remainingData;
            else if (result.remaining) remainingData = result.remaining;
            else if (result.dataRemaining) remainingData = result.dataRemaining;
            else if (result.remainingMB) remainingData = result.remainingMB;
            
            if (remainingData < 100 && result.unit === 'GB') {
                remainingData = remainingData * 1024;
            }
            
            return { success: true, data: Math.round(remainingData), unit: 'MB' };
        }
        return { success: false, data: 0 };
    } catch (error) {
        return { success: false, data: 0 };
    }
}

// 3. Voice Usage (မိနစ်လက်ကျန်)
async function getRealVoiceUsage(accessToken) {
    try {
        const url = `${MYTEL_API_BASE}/account-detail/api/v1.2/individual/voice-usage`;
        const response = await axios.get(url, { headers: getMytelHeaders(accessToken), timeout: 10000 });
        
        if (response.data && response.data.errorCode === 200 && response.data.result) {
            let remainingMinutes = 0;
            const result = response.data.result;
            
            if (result.remainingMinutes) remainingMinutes = result.remainingMinutes;
            else if (result.remaining) remainingMinutes = result.remaining;
            else if (result.minutesRemaining) remainingMinutes = result.minutesRemaining;
            
            return { success: true, minutes: remainingMinutes };
        }
        return { success: false, minutes: 0 };
    } catch (error) {
        return { success: false, minutes: 0 };
    }
}

// 4. SMS Usage (SMS လက်ကျန်)
async function getRealSmsUsage(accessToken) {
    try {
        const url = `${MYTEL_API_BASE}/account-detail/api/v1.2/individual/sms-usage`;
        const response = await axios.get(url, { headers: getMytelHeaders(accessToken), timeout: 10000 });
        
        if (response.data && response.data.errorCode === 200 && response.data.result) {
            let remainingSms = 0;
            const result = response.data.result;
            
            if (result.remainingSMS) remainingSms = result.remainingSMS;
            else if (result.remaining) remainingSms = result.remaining;
            else if (result.smsRemaining) remainingSms = result.smsRemaining;
            
            return { success: true, sms: remainingSms };
        }
        return { success: false, sms: 0 };
    } catch (error) {
        return { success: false, sms: 0 };
    }
}

// 5. Points (အမှတ်များ) - From Account Main API
async function getRealPoints(accessToken) {
    try {
        const url = `${MYTEL_API_BASE}/account-detail/api/v1.2/individual/account-main`;
        const response = await axios.get(url, { headers: getMytelHeaders(accessToken), timeout: 10000 });
        
        if (response.data && response.data.errorCode === 200 && response.data.result) {
            const result = response.data.result;
            // Try to find points in different possible fields
            const points = result.loyaltyPoints || result.points || result.rewardPoints || result.mytelPoints || 0;
            return { success: true, points: points };
        }
        return { success: false, points: 0 };
    } catch (error) {
        return { success: false, points: 0 };
    }
}

// ==================== AUTH API ====================

app.post('/api/auth/send-otp', async (req, res) => {
    console.log('\n📨 POST /api/auth/send-otp');
    
    try {
        const { phone } = req.body;
        
        if (!phone || phone.length < 9) {
            return res.status(400).json({ success: false, error: 'ဖုန်းနံပါတ် မှန်ကန်စွာ ထည့်ပါ' });
        }
        
        let formattedPhone = phone;
        if (phone.startsWith('09')) formattedPhone = phone;
        else if (phone.startsWith('959')) formattedPhone = '0' + phone.substring(2);
        
        console.log(`📞 Phone: ${formattedPhone}`);
        
        const otpResult = await sendMytelOTP(formattedPhone);
        console.log('Send OTP result:', otpResult);
        
        if (otpResult.errorCode === 200) {
            const localOTP = Math.floor(100000 + Math.random() * 900000).toString();
            saveOTP(formattedPhone, localOTP);
            
            res.json({ success: true, message: 'OTP ကုဒ် ပို့ပြီးပါပြီ။ သင့် SMS ကို စစ်ဆေးပါ။' });
        } else {
            res.status(500).json({ success: false, error: otpResult.message || 'OTP ပို့ရန် မအောင်မြင်ပါ။' });
        }
    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.post('/api/auth/verify-otp', async (req, res) => {
    console.log('\n🔐 POST /api/auth/verify-otp');
    
    try {
        let { phone, otp } = req.body;
        
        if (!phone || !otp) {
            return res.status(400).json({ success: false, error: 'ဖုန်းနံပါတ်နှင့် OTP ထည့်ပါ' });
        }
        
        const convertedOtp = convertToEnglishNumbers(otp);
        
        let formattedPhone = phone;
        if (phone.startsWith('09')) formattedPhone = phone;
        else if (phone.startsWith('959')) formattedPhone = '0' + phone.substring(2);
        
        console.log(`Phone: ${formattedPhone}, OTP: ${convertedOtp}`);
        
        const deviceId = generateDeviceId();
        const validation = await validateMytelOTP(formattedPhone, convertedOtp, deviceId);
        
        if (validation.success) {
            req.session.userPhone = formattedPhone;
            req.session.isAuthenticated = true;
            req.session.accessToken = validation.accessToken;
            
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
            res.json({ success: true, message: 'အကောင့်ဝင်ရောက်မှု အောင်မြင်ပါသည်' });
        } else {
            const isValidLocal = verifyOTP(formattedPhone, convertedOtp);
            if (isValidLocal) {
                req.session.userPhone = formattedPhone;
                req.session.isAuthenticated = true;
                res.json({ success: true, message: 'အကောင့်ဝင်ရောက်မှု အောင်မြင်ပါသည်' });
            } else {
                res.status(401).json({ success: false, error: 'OTP ကုဒ် မှားယွင်းနေပါသည်။' });
            }
        }
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.get('/api/auth/status', (req, res) => {
    if (req.session.isAuthenticated && req.session.userPhone) {
        res.json({ authenticated: true, phone: req.session.userPhone });
    } else {
        res.json({ authenticated: false });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// ==================== REAL BALANCE API (All in One) ====================
app.get('/api/user/balance', async (req, res) => {
    if (!req.session.isAuthenticated) {
        return res.status(401).json({ success: false, error: 'ကျေးဇူးပြု၍ အကောင့်ဝင်ပါ' });
    }
    
    const accessToken = req.session.accessToken;
    
    if (!accessToken) {
        return res.json({ success: true, balance: 0, minutes: 0, data: 0, sms: 0, points: 0, source: 'no-token' });
    }
    
    console.log(`\n📊 Fetching REAL balance for: ${req.session.userPhone}`);
    
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
        
        console.log('✅ Response:', responseData);
        res.json(responseData);
        
    } catch (error) {
        console.error('Balance API error:', error);
        res.json({ success: true, balance: 0, minutes: 0, data: 0, sms: 0, points: 0, source: 'error' });
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
    if (req.body.password === process.env.ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== STATIC ROUTES ====================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// ==================== START SERVER ====================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n╔════════════════════════════════════════════════════════════╗`);
    console.log(`║  🚀 MYTEL REAL API WITH ALL BALANCE                       ║`);
    console.log(`║  💰 Balance | 📶 Data | 📞 Minutes | 💬 SMS | ⭐ Points   ║`);
    console.log(`║  📱 Store: https://ath-digital-hub.onrender.com/         ║`);
    console.log(`║  📡 Fetching REAL data from Mytel servers                ║`);
    console.log(`╚════════════════════════════════════════════════════════════╝\n`);
});
