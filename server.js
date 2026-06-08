const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const helmet = require('helmet');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const compression = require('compression');
const sharp = require('sharp');
const Joi = require('joi');
const { supabase, supabaseAdmin, createNewUser, getUserByPhone, getUserStats, updateUserStats, isPhoneBlocked } = require('./database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== SALES HOURS CONFIGURATION ====================
let salesHours = {
    enabled: true,
    mode: 'auto',           // 'auto' or 'manual'
    startHour: 9,           // 9 AM
    endHour: 19,            // 7 PM (24-hour format)
    timezone: 'Asia/Yangon',
    manualStatus: true,     // Manual mode မှာ ဖွင့်/ပိတ်
    message: 'ကျေးဇူးပြု၍ နံနက် ၉ နာရီမှ ညနေ ၇ နာရီအတွင်းမှသာ ဝယ်ယူနိုင်ပါသည်။'
};

// Helper function to convert 24-hour to 12-hour format with Myanmar labels
function convertTo12HourFormat(hour24) {
    if (hour24 === 0 || hour24 === 24) return { hour: 12, label: "ည" };
    if (hour24 === 12) return { hour: 12, label: "မွန်းတည့်" };
    if (hour24 < 12) return { hour: hour24, label: "နံနက်" };
    return { hour: hour24 - 12, label: "ညနေ" };
}

// Check if order can be placed based on mode
function canPlaceOrder() {
    if (!salesHours.enabled) return true;
    
    if (salesHours.mode === 'manual') {
        // Manual mode - admin controls directly
        return salesHours.manualStatus;
    } else {
        // Auto mode - based on time
        const now = new Date();
        const myanmarTime = new Date(now.toLocaleString('en-US', { timeZone: salesHours.timezone }));
        const currentHour = myanmarTime.getHours();
        return currentHour >= salesHours.startHour && currentHour < salesHours.endHour;
    }
}

// Get current status message - SIMPLE VERSION with 12-hour format (no technical info for users)
function getStatusMessage() {
    const isOpen = canPlaceOrder();
    
    if (!isOpen) {
        return "🔴 ဆိုင်ပိတ်ထားပါသည်။ ကျေးဇူးပြု၍ နောက်မှထပ်မံဝယ်ယူပါ။";
    }
    
    // Shop is open
    if (salesHours.mode === 'auto') {
        const start = convertTo12HourFormat(salesHours.startHour);
        const end = convertTo12HourFormat(salesHours.endHour);
        return `🟢 ဆိုင်ဖွင့်ချိန် (${start.label} ${start.hour}:00 မှ ${end.label} ${end.hour}:00)`;
    } else {
        // Manual mode - simple message without "Admin" text
        return "🟢 ဆိုင်ဖွင့်ထားပါသည်။ ယခုပဲဝယ်ယူနိုင်ပါသည်။";
    }
}

// ==================== VALIDATION SCHEMAS ====================
const phoneSchema = Joi.string().pattern(/^09[0-9]{7,9}$/).required();
const usernameSchema = Joi.string().min(2).max(50).pattern(/^[a-zA-Z0-9\u1000-\u109F\s]+$/).required();
const orderSchema = Joi.object({
    phone: phoneSchema,
    plan: Joi.string().valid('VIP LEVEL - 1', 'VIP LEVEL - 2', 'VIP LEVEL - 3', 'VIP LEVEL - 4 (ULTRA)').required(),
    price: Joi.number().valid(15000, 20000, 25000, 30000).required(),
    payment_method: Joi.string().valid('kpay', 'wavepay', 'ayapay').default('kpay')
});

function maskPhone(phone) {
    if (!phone || phone.length < 8) return phone || '';
    return phone.substring(0, 5) + '***' + phone.substring(phone.length - 3);
}

// ==================== SECURITY MIDDLEWARE ====================
app.use(compression());
app.use(morgan('combined'));

// ==================== CSP CONFIGURATION ====================
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "cdnjs.cloudflare.com", "blob:"],
            scriptSrcAttr: ["'unsafe-inline'"],
            scriptSrcElem: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
            styleSrcElem: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:", "http:", "i.ibb.co", "blob:"],
            connectSrc: ["'self'", process.env.SUPABASE_URL, "https://*.supabase.co", "wss://*.supabase.co"],
            frameSrc: ["'self'"],
            frameAncestors: ["'self'"],
            formAction: ["'self'"],
            baseUri: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            workerSrc: ["'self'", "blob:"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    frameguard: { action: 'sameorigin' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// ==================== EXTRA SECURITY HEADERS ====================
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    next();
});

// ==================== RATE LIMITING ====================
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: { error: 'Too many requests, please try again later.' },
    keyGenerator: (req) => req.ip,
    skip: (req) => req.path === '/api/health'
});

const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { error: 'Too many chat requests. Please wait a moment.' },
    keyGenerator: (req) => req.ip
});

const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: { error: 'Too many admin requests. Please wait before refreshing.' },
    keyGenerator: (req) => req.session?.isAdmin ? req.ip : req.ip,
    skip: (req) => !req.session?.isAdmin
});

const marketLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { error: 'Too many requests, please try again later.' }
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Too many login attempts, please try again later.' },
    skipSuccessfulRequests: true
});

const orderLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 3,
    message: { error: 'Too many orders. Please wait a moment.' },
    keyGenerator: (req) => req.body.phone || req.ip
});

app.use('/api/', apiLimiter);

// ==================== SESSION CONFIGURATION ====================
const sessionConfig = {
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    name: 'sessionId',
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 2,
        sameSite: 'strict',
        domain: process.env.COOKIE_DOMAIN || undefined
    },
    rolling: true
};

if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

app.use(session(sessionConfig));

// ==================== CORS ====================
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? process.env.ALLOWED_ORIGINS?.split(',') : '*',
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(__dirname));

// ==================== FILE UPLOAD ====================
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static('uploads'));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueName = crypto.randomBytes(16).toString('hex') + path.extname(file.originalname);
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
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
});

async function processImage(inputPath) {
    try {
        const outputPath = inputPath.replace(/\.\w+$/, '_processed.jpg');
        await sharp(inputPath)
            .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80, progressive: true })
            .toFile(outputPath);
        fs.unlinkSync(inputPath);
        return outputPath.replace('uploads/', '/uploads/');
    } catch (error) {
        console.error('Image processing failed:', error);
        return inputPath.replace('uploads/', '/uploads/');
    }
}

// ==================== PAYMENT METHODS ====================
const PAYMENT_METHODS = {
    kpay: { name: 'KBZ Pay', account_name: 'AUNG THU HTWE', account_number: '09789999368', icon: 'https://i.ibb.co/CpyBHvrS/1000011452.jpg' },
    wavepay: { name: 'WavePay', account_name: 'AUNG THU HTWE', account_number: '09789999368', icon: 'https://i.ibb.co/9990m00N/FB-IMG-1780586423015.jpg' },
    ayapay: { name: 'AYA Pay', account_name: 'AUNG THU HTWE', account_number: '09789999368', icon: 'https://i.ibb.co/rPzL2xm/aya-pay.jpg' }
};

// ==================== HELPER FUNCTIONS ====================
function calculateImageHash(fileBuffer) {
    return crypto.createHash('md5').update(fileBuffer).digest('hex');
}

async function isDuplicateOrder(phone, plan) {
    try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { data, error } = await supabaseAdmin
            .from('orders')
            .select('id')
            .eq('phone', phone)
            .eq('plan', plan)
            .gte('created_at', fiveMinutesAgo)
            .limit(1);
        if (error) return false;
        return data && data.length > 0;
    } catch (e) { return false; }
}

async function isDuplicateImage(imageHash) {
    if (!imageHash) return false;
    try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabaseAdmin
            .from('orders')
            .select('id')
            .eq('image_hash', imageHash)
            .gte('created_at', oneDayAgo)
            .limit(1);
        if (error) return false;
        return data && data.length > 0;
    } catch (e) { return false; }
}

const orderRateLimit = new Map();
function checkRateLimit(phone) {
    const now = Date.now();
    const userOrders = orderRateLimit.get(phone) || [];
    const recentOrders = userOrders.filter(time => now - time < 60 * 1000);
    if (recentOrders.length >= 3) return false;
    recentOrders.push(now);
    orderRateLimit.set(phone, recentOrders);
    return true;
}

function isAuthenticated(req, res, next) {
    if (req.session.isAdmin) {
        next();
    } else {
        res.status(401).json({ success: false, error: 'Unauthorized' });
    }
}

// ==================== DATABASE NOTIFICATION FUNCTIONS ====================
async function addNotificationToDatabase(order) {
    try {
        const { error } = await supabaseAdmin
            .from('admin_notifications')
            .insert([{
                order_id: order.id,
                title: `🆕 New Order #${order.id}`,
                message: `${order.plan} - ${order.price.toLocaleString()} MMK from ${maskPhone(order.phone)}`,
                is_read: false,
                created_at: new Date().toISOString()
            }]);
        if (error) console.error('Error saving notification:', error);
    } catch (e) {
        console.error('Exception saving notification:', e);
    }
}

// ==================== AUTO CLEANUP ====================
async function autoCleanupOldOrders() {
    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: ordersToDelete } = await supabaseAdmin
            .from('orders')
            .select('slip_url')
            .in('status', ['Pending', 'Rejected'])
            .lt('created_at', thirtyDaysAgo);
        
        if (ordersToDelete && ordersToDelete.length > 0) {
            for (const order of ordersToDelete) {
                if (order.slip_url) {
                    const filePath = path.join(__dirname, order.slip_url);
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                }
            }
        }
        await supabaseAdmin.from('orders').delete().in('status', ['Pending', 'Rejected']).lt('created_at', thirtyDaysAgo);
    } catch (e) { console.error('Auto cleanup failed:', e); }
}

setTimeout(autoCleanupOldOrders, 5000);
setInterval(autoCleanupOldOrders, 24 * 60 * 60 * 1000);

// ==================== LIVE SYSTEM ====================
let liveClients = [];

app.get('/api/live/events', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });
    const clientId = Date.now();
    liveClients.push({ id: clientId, res });
    req.on('close', () => {
        liveClients = liveClients.filter(client => client.id !== clientId);
    });
});

async function broadcastNewOrder(order) {
    const message = `data: ${JSON.stringify({ type: 'new_order', order })}\n\n`;
    liveClients.forEach(client => { try { client.res.write(message); } catch(e) {} });
}

app.get('/api/payment-methods', (req, res) => {
    res.json({ methods: PAYMENT_METHODS });
});

// ==================== SALES HOURS API ====================

// Get current sales status (public)
app.get('/api/sales/status', (req, res) => {
    const isOpen = canPlaceOrder();
    const message = getStatusMessage();
    
    res.json({
        success: true,
        isOpen: isOpen,
        mode: salesHours.mode,
        startHour: salesHours.startHour,
        endHour: salesHours.endHour,
        manualStatus: salesHours.manualStatus,
        message: message
    });
});

// Admin endpoint to update sales hours
app.post('/api/admin/sales-hours', isAuthenticated, (req, res) => {
    const { enabled, mode, startHour, endHour, manualStatus } = req.body;
    
    if (enabled !== undefined) salesHours.enabled = enabled;
    if (mode !== undefined && (mode === 'auto' || mode === 'manual')) salesHours.mode = mode;
    if (startHour !== undefined && startHour >= 0 && startHour <= 23) salesHours.startHour = startHour;
    if (endHour !== undefined && endHour >= 0 && endHour <= 23) salesHours.endHour = endHour;
    if (manualStatus !== undefined) salesHours.manualStatus = manualStatus;
    
    res.json({ 
        success: true, 
        salesHours: salesHours,
        message: 'ရောင်းချချိန် သတ်မှတ်ချက်ကို ပြင်ဆင်ပြီးပါပြီ။'
    });
});

// Admin endpoint to get current sales hours
app.get('/api/admin/sales-hours', isAuthenticated, (req, res) => {
    res.json({ success: true, salesHours: salesHours });
});

// Admin endpoint to toggle shop (manual mode only)
app.post('/api/admin/toggle-shop', isAuthenticated, (req, res) => {
    const { isOpen } = req.body;
    if (salesHours.mode === 'manual') {
        salesHours.manualStatus = isOpen;
        res.json({ success: true, isOpen: isOpen, message: `ဆိုင် ${isOpen ? 'ဖွင့်လိုက်ပြီ' : 'ပိတ်လိုက်ပြီ'}` });
    } else {
        res.status(400).json({ success: false, error: 'Auto mode မှာ manual toggle မရပါ။ Auto mode ကို Manual mode ပြောင်းပါ။' });
    }
});

// ==================== STATIC ROUTES ====================
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });
app.get('/admin.html', (req, res) => { res.sendFile(path.join(__dirname, 'admin.html')); });
app.get('/dashboard.html', (req, res) => { res.sendFile(path.join(__dirname, 'dashboard_live.html')); });
app.get('/chat.html', (req, res) => { res.sendFile(path.join(__dirname, 'chat.html')); });
app.get('/admin-chat.html', (req, res) => { res.sendFile(path.join(__dirname, 'admin-chat.html')); });
app.get('/api/health', (req, res) => { res.json({ status: 'ok', timestamp: new Date().toISOString() }); });

// ==================== USER REGISTRATION ====================
app.post('/api/user/register', async (req, res) => {
    try {
        const { phone, username } = req.body;
        const { error: phoneError } = phoneSchema.validate(phone);
        if (phoneError) {
            return res.status(400).json({ success: false, error: 'Invalid phone number format' });
        }
        const { error: usernameError } = usernameSchema.validate(username);
        if (usernameError) {
            return res.status(400).json({ success: false, error: 'Invalid username format' });
        }
        let user = await getUserByPhone(phone);
        let isNewUser = false;
        if (!user) {
            user = await createNewUser(phone, username);
            isNewUser = true;
        }
        if (!user) {
            return res.status(500).json({ success: false, error: 'Failed to create user' });
        }
        if (user.blocked) {
            return res.status(403).json({ success: false, error: 'Your account has been blocked. Contact support.' });
        }
        res.json({ 
            success: true, 
            user: {
                phone: user.phone,
                username: user.username,
                user_id: user.user_id,
                order_count: user.order_count,
                blocked: user.blocked
            },
            isNewUser: isNewUser
        });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/user/:phone', async (req, res) => {
    try {
        const { phone } = req.params;
        const user = await getUserByPhone(phone);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        res.json({ 
            success: true, 
            user: {
                phone: user.phone,
                username: user.username,
                user_id: user.user_id,
                order_count: user.order_count,
                blocked: user.blocked
            }
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== MARKET API ====================
app.get('/api/market/products', marketLimiter, async (req, res) => {
    try {
        const { data, error } = await supabase.from('market_products').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ products: data || [] });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ products: [], error: error.message });
    }
});

app.post('/api/market/products', isAuthenticated, async (req, res) => {
    try {
        const { name, price, image, category, icon, discount } = req.body;
        if (!name || !price) {
            return res.status(400).json({ success: false, error: 'Name and price are required' });
        }
        const { data, error } = await supabase.from('market_products').insert([{
            name, price: parseInt(price), image: image || null,
            category: category || 'Uncategorized', icon: icon || 'fas fa-box',
            discount: discount || 0, created_at: new Date().toISOString()
        }]).select();
        if (error) throw error;
        res.json({ success: true, product: data[0] });
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/market/products/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, image, category, icon, discount } = req.body;
        if (!name || !price) {
            return res.status(400).json({ success: false, error: 'Name and price are required' });
        }
        const { data, error } = await supabase.from('market_products').update({
            name, price: parseInt(price), image: image || null,
            category: category || 'Uncategorized', icon: icon || 'fas fa-box',
            discount: discount || 0, updated_at: new Date().toISOString()
        }).eq('id', parseInt(id)).select();
        if (error) throw error;
        res.json({ success: true, product: data[0] });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/market/products/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('market_products').delete().eq('id', parseInt(id));
        if (error) throw error;
        res.json({ success: true, message: 'Product deleted' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== USER ORDERS API ====================
app.get('/api/orders/:phone', async (req, res) => {
    try {
        const { phone } = req.params;
        if (!phone || phone === 'null' || phone === 'undefined') {
            return res.status(400).json({ orders: [], error: 'Invalid phone number' });
        }
        const { data, error } = await supabase.from('orders').select('*').eq('phone', phone).order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ orders: data || [] });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ orders: [], error: error.message });
    }
});

// ==================== PUBLIC LIVE API ====================
app.get('/api/live/orders', async (req, res) => {
    try {
        const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(50);
        if (error) throw error;
        res.json({ orders: data || [] });
    } catch (error) {
        console.error('Error fetching live orders:', error);
        res.status(500).json({ orders: [], error: error.message });
    }
});

app.get('/api/live/order/:phone', async (req, res) => {
    try {
        const { phone } = req.params;
        if (!phone || phone === 'null' || phone === 'undefined') {
            return res.status(400).json({ orders: [], error: 'Invalid phone number' });
        }
        const { data, error } = await supabase.from('orders').select('*').eq('phone', phone).order('created_at', { ascending: false }).limit(50);
        if (error) throw error;
        res.json({ orders: data || [] });
    } catch (error) {
        console.error('Error fetching order by phone:', error);
        res.status(500).json({ orders: [], error: error.message });
    }
});

// ==================== CREATE ORDER ====================
app.post('/api/orders', orderLimiter, upload.single('slip'), async (req, res) => {
    try {
        // Check if shop is open based on mode
        if (!canPlaceOrder()) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(403).json({ 
                success: false, 
                error: getStatusMessage(),
                isOpen: false,
                mode: salesHours.mode
            });
        }
        
        const { phone, plan, price, sender_name, last5_digits, payment_method } = req.body;
        const slipFile = req.file;
        
        const { error } = orderSchema.validate({ phone, plan, price, payment_method });
        if (error) {
            if (slipFile) fs.unlinkSync(slipFile.path);
            return res.status(400).json({ success: false, error: error.message });
        }
        
        const blocked = await isPhoneBlocked(phone);
        if (blocked) {
            if (slipFile) fs.unlinkSync(slipFile.path);
            return res.status(403).json({ success: false, error: 'This phone number has been blocked.' });
        }
        
        if (!checkRateLimit(phone)) {
            if (slipFile) fs.unlinkSync(slipFile.path);
            return res.status(429).json({ success: false, error: 'Too many orders. Please wait a moment.' });
        }
        
        const duplicate = await isDuplicateOrder(phone, plan);
        if (duplicate) {
            if (slipFile) fs.unlinkSync(slipFile.path);
            return res.status(409).json({ success: false, error: 'Duplicate order detected. Please wait 5 minutes.' });
        }
        
        let slipUrl = null;
        let imageHash = null;
        
        if (slipFile) {
            const processedPath = await processImage(slipFile.path);
            slipUrl = processedPath;
            const fileBuffer = fs.readFileSync(path.join(__dirname, slipUrl));
            imageHash = calculateImageHash(fileBuffer);
            
            const duplicateImage = await isDuplicateImage(imageHash);
            if (duplicateImage) {
                fs.unlinkSync(path.join(__dirname, slipUrl));
                return res.status(409).json({ success: false, error: 'Duplicate screenshot detected.' });
            }
        }
        
        const orderId = Date.now();
        const { error: insertError } = await supabase.from('orders').insert([{
            id: orderId, phone, plan, price: parseInt(price), status: 'Pending',
            slip_url: slipUrl, image_hash: imageHash,
            sender_name: sender_name || null, last5_digits: last5_digits || null,
            payment_method: payment_method || 'kpay', created_at: new Date().toISOString()
        }]);
        
        if (insertError) throw insertError;
        
        await updateUserStats(phone, false);
        
        const { data: newOrder } = await supabase.from('orders').select('*').eq('id', orderId).single();
        if (newOrder) {
            await broadcastNewOrder(newOrder);
            await addNotificationToDatabase(newOrder);
        }
        
        res.json({ success: true, orderId: orderId, message: 'Order created successfully' });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== ADMIN API (with adminLimiter) ====================
app.get('/api/admin/orders', isAuthenticated, adminLimiter, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin.from('orders').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ orders: data || [] });
    } catch (error) {
        console.error('Error fetching all orders:', error);
        res.status(500).json({ orders: [], error: error.message });
    }
});

app.get('/api/admin/user-stats', isAuthenticated, adminLimiter, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin.from('user_stats').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ stats: data || [] });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({ stats: [], error: error.message });
    }
});

app.get('/api/admin/suspect-users', isAuthenticated, adminLimiter, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin.from('user_stats').select('*').eq('suspect_flag', true).order('reject_count', { ascending: false });
        if (error) throw error;
        res.json({ success: true, users: data || [] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/admin/blocked-users', isAuthenticated, adminLimiter, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin.from('user_stats').select('*').eq('blocked', true).order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, users: data || [] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/admin/search-users', isAuthenticated, adminLimiter, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.trim() === '') {
            return res.json({ success: true, users: [] });
        }
        const { data, error } = await supabaseAdmin.from('user_stats').select('*').or(`phone.ilike.%${q}%,username.ilike.%${q}%,user_id.ilike.%${q}%`).order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, users: data || [] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== DATABASE NOTIFICATIONS ENDPOINTS ====================
app.get('/api/admin/notifications', isAuthenticated, adminLimiter, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('admin_notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);
        
        if (error) throw error;
        res.json({ success: true, notifications: data || [] });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/notifications/clear', isAuthenticated, async (req, res) => {
    try {
        const { error } = await supabaseAdmin
            .from('admin_notifications')
            .delete()
            .neq('id', 0);
        
        if (error) throw error;
        res.json({ success: true, message: 'All notifications cleared from database' });
    } catch (error) {
        console.error('Error clearing notifications:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/admin/notifications/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseAdmin
            .from('admin_notifications')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true, message: 'Notification deleted' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/admin/notifications/:id/read', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseAdmin
            .from('admin_notifications')
            .update({ is_read: true })
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true, message: 'Marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/admin/notifications/read-all', isAuthenticated, async (req, res) => {
    try {
        const { error } = await supabaseAdmin
            .from('admin_notifications')
            .update({ is_read: true })
            .neq('id', 0);
        
        if (error) throw error;
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all as read:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/admin/notifications/unread-count', isAuthenticated, async (req, res) => {
    try {
        const { count, error } = await supabaseAdmin
            .from('admin_notifications')
            .select('*', { count: 'exact', head: true })
            .eq('is_read', false);
        
        if (error) throw error;
        res.json({ success: true, unreadCount: count || 0 });
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== ADMIN USER MANAGEMENT ====================
app.post('/api/admin/user-block', isAuthenticated, async (req, res) => {
    try {
        const { phone, block } = req.body;
        if (!phone) {
            return res.status(400).json({ success: false, error: 'Phone required' });
        }
        await supabaseAdmin.from('user_stats').update({ blocked: block, updated_at: new Date().toISOString() }).eq('phone', phone);
        res.json({ success: true, message: block ? 'User blocked' : 'User unblocked' });
    } catch (error) {
        console.error('Error blocking user:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/clear-suspect', isAuthenticated, async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ success: false, error: 'Phone required' });
        }
        await supabaseAdmin.from('user_stats').update({ suspect_flag: false, updated_at: new Date().toISOString() }).eq('phone', phone);
        res.json({ success: true, message: 'Suspect flag cleared' });
    } catch (error) {
        console.error('Error clearing suspect flag:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/user-delete', isAuthenticated, async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ success: false, error: 'Phone required' });
        }
        await supabaseAdmin.from('user_stats').delete().eq('phone', phone);
        res.json({ success: true, message: 'User deleted from stats' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/user-delete-orders', isAuthenticated, async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ success: false, error: 'Phone required' });
        }
        const { data: orders } = await supabaseAdmin.from('orders').select('slip_url').eq('phone', phone);
        if (orders && orders.length > 0) {
            for (const order of orders) {
                if (order.slip_url) {
                    const filePath = path.join(__dirname, order.slip_url);
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                }
            }
        }
        await supabaseAdmin.from('orders').delete().eq('phone', phone);
        res.json({ success: true, message: `Deleted ${orders?.length || 0} orders for ${phone}` });
    } catch (error) {
        console.error('Error deleting user orders:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/cleanup-old', isAuthenticated, async (req, res) => {
    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: ordersToDelete } = await supabaseAdmin.from('orders').select('slip_url').in('status', ['Pending', 'Rejected']).lt('created_at', thirtyDaysAgo);
        if (ordersToDelete && ordersToDelete.length > 0) {
            for (const order of ordersToDelete) {
                if (order.slip_url) {
                    const filePath = path.join(__dirname, order.slip_url);
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                }
            }
        }
        await supabaseAdmin.from('orders').delete().in('status', ['Pending', 'Rejected']).lt('created_at', thirtyDaysAgo);
        res.json({ success: true, message: `Deleted ${ordersToDelete?.length || 0} old orders` });
    } catch (error) {
        console.error('Error during manual cleanup:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/admin/orders/:id/approve', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        await supabaseAdmin.from('orders').update({ status: 'Approved', activated_at: new Date().toISOString() }).eq('id', id);
        res.json({ success: true, message: 'Order approved successfully' });
    } catch (error) {
        console.error('Error approving order:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/admin/orders/:id/reject', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { data: order } = await supabaseAdmin.from('orders').select('phone').eq('id', id).single();
        await supabaseAdmin.from('orders').update({ status: 'Rejected' }).eq('id', id);
        if (order) await updateUserStats(order.phone, true);
        res.json({ success: true, message: 'Order rejected successfully' });
    } catch (error) {
        console.error('Error rejecting order:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/admin/orders/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { data: order } = await supabaseAdmin.from('orders').select('slip_url').eq('id', id).single();
        if (order && order.slip_url) {
            const filePath = path.join(__dirname, order.slip_url);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        await supabaseAdmin.from('orders').delete().eq('id', id);
        res.json({ success: true, message: 'Order deleted successfully' });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== ADMIN LOGIN ====================
app.post('/api/admin/login', loginLimiter, async (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    if (password === adminPassword) {
        req.session.isAdmin = true;
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid password' });
    }
});

app.post('/api/admin/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logged out successfully' });
});

// ==================== SYSTEM RESET API ====================
app.post('/api/admin/system-reset', isAuthenticated, async (req, res) => {
    try {
        const { confirm, keepProducts } = req.body;
        if (confirm !== 'RESET_ALL_DATA') {
            return res.status(400).json({ success: false, error: 'Please type "RESET_ALL_DATA" to confirm' });
        }
        
        const uploadsFolder = path.join(__dirname, 'uploads');
        if (fs.existsSync(uploadsFolder)) {
            const files = fs.readdirSync(uploadsFolder);
            for (const file of files) {
                const filePath = path.join(uploadsFolder, file);
                if (fs.statSync(filePath).isFile()) fs.unlinkSync(filePath);
            }
        }
        
        await supabaseAdmin.from('orders').delete().neq('id', 0);
        await supabaseAdmin.from('user_stats').delete().neq('phone', '');
        await supabaseAdmin.from('admin_notifications').delete().neq('id', 0);
        orderRateLimit.clear();
        
        if (!keepProducts) {
            await supabaseAdmin.from('market_products').delete().neq('id', 0);
        }
        
        res.json({ success: true, message: 'System reset completed successfully' });
    } catch (error) {
        console.error('Error during system reset:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/user-reset/:phone', isAuthenticated, async (req, res) => {
    try {
        const { phone } = req.params;
        if (!phone) {
            return res.status(400).json({ success: false, error: 'Phone required' });
        }
        
        const { data: orders } = await supabaseAdmin.from('orders').select('slip_url').eq('phone', phone);
        if (orders && orders.length > 0) {
            for (const order of orders) {
                if (order.slip_url) {
                    const filePath = path.join(__dirname, order.slip_url);
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                }
            }
        }
        
        await supabaseAdmin.from('orders').delete().eq('phone', phone);
        await supabaseAdmin.from('user_stats').delete().eq('phone', phone);
        await supabaseAdmin.from('admin_notifications').delete().eq('order_id', phone);
        
        res.json({ success: true, message: `User ${phone} and all their data deleted successfully` });
    } catch (error) {
        console.error('Error deleting user data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== PUBLIC CHAT API (Global) ====================
app.get('/api/chat/messages', chatLimiter, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .order('created_at', { ascending: true })
            .limit(200);
        
        if (error) throw error;
        res.json({ success: true, messages: data || [] });
    } catch (error) {
        console.error('Error fetching chat messages:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/chat/send', chatLimiter, async (req, res) => {
    try {
        const { user_id, username, message } = req.body;
        
        if (!user_id || !message || message.trim() === '') {
            return res.status(400).json({ success: false, error: 'Invalid message' });
        }
        
        const { data, error } = await supabase
            .from('chat_messages')
            .insert([{
                user_id: user_id,
                username: username || 'User',
                message: message.substring(0, 500),
                is_admin: false,
                created_at: new Date().toISOString()
            }])
            .select();
        
        if (error) throw error;
        
        res.json({ success: true, message: data[0] });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/chat/admin/send', isAuthenticated, chatLimiter, async (req, res) => {
    try {
        const { user_id, username, message } = req.body;
        
        if (!message || message.trim() === '') {
            return res.status(400).json({ success: false, error: 'Invalid message' });
        }
        
        const { data, error } = await supabase
            .from('chat_messages')
            .insert([{
                user_id: user_id || 'admin',
                username: username || 'Admin',
                message: message.substring(0, 500),
                is_admin: true,
                created_at: new Date().toISOString()
            }])
            .select();
        
        if (error) throw error;
        
        res.json({ success: true, message: data[0] });
    } catch (error) {
        console.error('Error sending admin message:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/chat/messages/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        
        const { error } = await supabase
            .from('chat_messages')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        res.json({ success: true, message: 'Message deleted' });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== PRIVATE CHAT API (1-on-1) ====================
app.get('/api/chat/admin/users', isAuthenticated, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('private_chat_messages')
            .select('sender_id, sender_name, receiver_id, created_at')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const uniqueUsers = [];
        const seen = new Set();
        for (const msg of data || []) {
            if (msg.receiver_id === 'admin' && !seen.has(msg.sender_id)) {
                seen.add(msg.sender_id);
                uniqueUsers.push({
                    user_id: msg.sender_id,
                    username: msg.sender_name,
                    last_message_time: msg.created_at
                });
            }
        }
        
        res.json({ success: true, users: uniqueUsers });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/chat/private/:userId', chatLimiter, async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.query.currentUserId || 'admin';
        
        const { data, error } = await supabase
            .from('private_chat_messages')
            .select('*')
            .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUserId})`)
            .order('created_at', { ascending: true })
            .limit(200);
        
        if (error) throw error;
        
        if (currentUserId === 'admin') {
            await supabase
                .from('private_chat_messages')
                .update({ is_read: true })
                .eq('sender_id', userId)
                .eq('receiver_id', 'admin');
        }
        
        res.json({ success: true, messages: data || [] });
    } catch (error) {
        console.error('Error fetching private messages:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/chat/private/send', chatLimiter, async (req, res) => {
    try {
        const { sender_id, receiver_id, sender_name, receiver_name, message } = req.body;
        
        if (!sender_id || !receiver_id || !message || message.trim() === '') {
            return res.status(400).json({ success: false, error: 'Invalid message' });
        }
        
        const { data, error } = await supabase
            .from('private_chat_messages')
            .insert([{
                sender_id: sender_id,
                receiver_id: receiver_id,
                sender_name: sender_name || 'User',
                receiver_name: receiver_name || 'User',
                message: message.substring(0, 500),
                is_read: false,
                created_at: new Date().toISOString()
            }])
            .select();
        
        if (error) throw error;
        
        res.json({ success: true, message: data[0] });
    } catch (error) {
        console.error('Error sending private message:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/chat/private/unread/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const { count, error } = await supabase
            .from('private_chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('receiver_id', userId)
            .eq('is_read', false);
        
        if (error) throw error;
        
        res.json({ success: true, unreadCount: count || 0 });
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║     🚀 ATH DIGITAL HUB SERVER STARTED (FULLY WORKING)                   ║
║                                                                          ║
║     📱 User Store:      http://localhost:${PORT}/                         ║
║     👨‍💼 Admin Panel:     http://localhost:${PORT}/admin.html               ║
║     📊 Live Dashboard:  http://localhost:${PORT}/dashboard.html           ║
║     💬 Global Chat:     http://localhost:${PORT}/chat.html                ║
║     💬 Admin Chat:      http://localhost:${PORT}/admin-chat.html          ║
║     💬 Private 1-on-1 Chat: WORKING ✅                                   ║
║                                                                          ║
║     🔒 SECURITY FEATURES ENABLED:                                        ║
║        ✅ Helmet.js (Security Headers)                                   ║
║        ✅ CSP with iframe support                                        ║
║        ✅ Rate Limiting (General: 500/15min, Chat: 60/min)              ║
║        ✅ Sales Hours Control (Auto/Manual Mode)                        ║
║        ✅ SameSite=Strict Cookie (CSRF Protection)                       ║
║        ✅ Session-based Admin Auth (HttpOnly Cookie)                     ║
║        ✅ Input Validation (Joi)                                         ║
║        ✅ Image Processing (Sharp)                                       ║
║        ✅ Database Notifications                                         ║
║        ✅ Request Logging (Morgan)                                       ║
║        ✅ Compression (Gzip)                                             ║
║        ✅ Global Chat System                                             ║
║        ✅ Private 1-on-1 Chat System                                     ║
║                                                                          ║
║     💳 Payment Methods: KBZ Pay, WavePay, AYA Pay                        ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
    `);
});
