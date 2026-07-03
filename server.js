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

// ============ DATABASE ============
const { supabase, supabaseAdmin, createNewUser, getUserByPhone, getUserStats, updateUserStats, isPhoneBlocked } = require('./database.js');

// ============ AUTO REPLY ============
const { getAutoReply, setUserLanguage, getUserLanguage } = require('./config/autoReply.js');

// ============ ROUTES ============
const adRoutes = require('./routes/ad-routes.js');
const salesHoursRoutes = require('./routes/admin-sales-hours.js');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== SALES HOURS CONFIGURATION ====================
let salesHours = {
    enabled: true,
    mode: 'auto',
    startHour: 9,
    endHour: 19,
    timezone: 'Asia/Yangon',
    manualStatus: false,
    message: 'ကျေးဇူးပြု၍ နံနက် ၉ နာရီမှ ညနေ ၇ နာရီအတွင်းမှသာ ဝယ်ယူနိုင်ပါသည်။'
};

// ============ 12-HOUR FORMAT CONVERSION ============
function convertTo12HourFormat(hour24) {
    if (hour24 === 0 || hour24 === 24) return { hour: 12, label: "ည" };
    if (hour24 === 12) return { hour: 12, label: "မွန်းတည့်" };
    if (hour24 < 12) return { hour: hour24, label: "နံနက်" };
    return { hour: hour24 - 12, label: "ညနေ" };
}

function getTimeDisplay(hour24) {
    const { hour, label } = convertTo12HourFormat(hour24);
    return `${label} ${hour}:00`;
}

function canPlaceOrder() {
    if (!salesHours.enabled) return true;
    if (salesHours.mode === 'manual') return salesHours.manualStatus;
    const now = new Date();
    const myanmarTime = new Date(now.toLocaleString('en-US', { timeZone: salesHours.timezone }));
    const currentHour = myanmarTime.getHours();
    return currentHour >= salesHours.startHour && currentHour < salesHours.endHour;
}

function getStatusMessage() {
    const isOpen = canPlaceOrder();
    if (!isOpen) return "🔴 ဆိုင်ပိတ်ထားပါသည်။ ကျေးဇူးပြု၍ နောက်မှထပ်မံဝယ်ယူပါ။";
    if (salesHours.mode === 'auto') {
        const start = getTimeDisplay(salesHours.startHour);
        const end = getTimeDisplay(salesHours.endHour);
        return `🟢 ဆိုင်ဖွင့်ချိန် (${start} မှ ${end})`;
    } else {
        return "🟢 ဆိုင်ဖွင့်ထားပါသည်။ ယခုပဲဝယ်ယူနိုင်ပါသည်။";
    }
}

// ==================== SEND AUTO REPLY FUNCTION ====================
async function sendAutoReply(sender_id, sender_name, replyMessage) {
    try {
        const { error } = await supabase
            .from('private_chat_messages')
            .insert([{
                sender_id: 'admin',
                receiver_id: sender_id,
                sender_name: '🤖 Auto Reply',
                receiver_name: sender_name || 'User',
                message: replyMessage,
                is_read: false,
                created_at: new Date().toISOString()
            }]);
        if (error) console.error('Error sending auto reply:', error);
        else console.log(`✅ Auto reply sent to ${sender_id}`);
    } catch (error) {
        console.error('Error in sendAutoReply:', error);
    }
}

// ==================== BAD WORDS FILTER ====================
const badWords = [
    'ငါလိုးမသား', 'လီးလား', 'မင်းမေလိုး', 'မင်းမေစပက်', 'မင်းနှမငါလိုး',
    'ကိုမေကိုလိုး', 'kmkl', 'ခွေးမသား', 'သူတောင်းစား', 'မင်းအမေငါလိုး',
    'အမောက်စာ', 'မိုက်မဲ', 'အတုံအခဲ', 'မသာ', 'မသာကောင်', 'သေချင်းစိုး', 'အမဲခြောက်',
    'သေလိုက်', 'သေနေတာလား', 'သေချင်လိုက်တာ', 'အသက်သေ', 'သတ်မယ်',
    'shit', 'fuck', 'damn', 'stupid', 'idiot', 'asshole', 'bastard', 'motherfucker',
    'bitch', 'whore', 'slut', 'cunt', 'pussy', 'dick', 'cock',
    'kill', 'murder', 'death', 'die', 'attack', 'bomb', 'threat',
    'သတ်မယ်', 'သေအောင်လုပ်မယ်', 'လာမယ်', 'ဖျက်ဆီးမယ်', 'မီးရှို့မယ်',
    'အပြင်ထွက်ချင်လား', 'တွေ့ချင်လား', 'လာတွေ့စမ်း', 'ရှေ့ထွက်ချင်လား', 'ရဲရဲထွက်လား', 'ကြောက်လို့လား',
    'fight', 'challenge'
];

function containsBadWords(message) {
    const lowerMessage = message.toLowerCase();
    for (const word of badWords) {
        if (lowerMessage.includes(word.toLowerCase())) {
            return true;
        }
    }
    return false;
}

// ==================== GLOBAL CHAT CLEANUP ====================
async function cleanupOldGlobalMessages() {
    try {
        const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
        const { error } = await supabase
            .from('chat_messages')
            .delete()
            .lt('created_at', threeMinutesAgo);
        if (error) console.error('Error cleaning up old global messages:', error);
        else console.log(`🧹 Cleaned up global messages older than 3 minutes`);
    } catch (error) {
        console.error('Error in cleanupOldGlobalMessages:', error);
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

// ==================== UPDATED CSP ====================
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "cdnjs.cloudflare.com", "cdn.jsdelivr.net", "esm.sh", "blob:"],
            scriptSrcAttr: ["'unsafe-inline'"],
            scriptSrcElem: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com", "cdn.jsdelivr.net", "esm.sh"],
            styleSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com", "fonts.googleapis.com"],
            styleSrcElem: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com", "fonts.googleapis.com"],
            fontSrc: ["'self'", "fonts.gstatic.com", "cdnjs.cloudflare.com", "data:"],
            imgSrc: ["'self'", "data:", "https:", "http:", "i.ibb.co", "blob:", "imgur.com", "i.imgur.com"],
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
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    frameguard: { action: 'sameorigin' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

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
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, message: { error: 'Too many requests' }, keyGenerator: (req) => req.ip, skip: (req) => req.path === '/api/health' });
const chatLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: { error: 'Too many chat requests' }, keyGenerator: (req) => req.ip });
const adminLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, message: { error: 'Too many admin requests' }, keyGenerator: (req) => req.session?.isAdmin ? req.ip : req.ip, skip: (req) => !req.session?.isAdmin });
const marketLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { error: 'Too many requests' } });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: { error: 'Too many login attempts' }, skipSuccessfulRequests: true });
const orderLimiter = rateLimit({ windowMs: 60 * 1000, max: 3, message: { error: 'Too many orders' }, keyGenerator: (req) => req.body.phone || req.ip });

app.use('/api/', apiLimiter);
app.use('/api/admin/', adminLimiter);
app.use('/api/chat/', chatLimiter);

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
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use(session(sessionConfig));

// ==================== CORS ====================
app.use(cors({ origin: process.env.NODE_ENV === 'production' ? process.env.ALLOWED_ORIGINS?.split(',') : '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==================== STATIC FILES ====================
app.use(express.static(path.join(__dirname, 'public')));

// ==================== API ROUTES ====================
app.use('/api', adRoutes);
app.use('/api', salesHoursRoutes);

// ==================== FILE UPLOAD ====================
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static('uploads'));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + path.extname(file.originalname))
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        cb(null, mimetype && extname);
    }
});

async function processImage(inputPath) {
    try {
        const outputPath = inputPath.replace(/\.\w+$/, '_processed.jpg');
        await sharp(inputPath).resize(800, 800, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80, progressive: true }).toFile(outputPath);
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

function calculateImageHash(fileBuffer) { return crypto.createHash('md5').update(fileBuffer).digest('hex'); }

async function isDuplicateOrder(phone, plan) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin.from('orders').select('id').eq('phone', phone).eq('plan', plan).gte('created_at', fiveMinutesAgo).limit(1);
    if (error) return false;
    return data && data.length > 0;
}

async function isDuplicateImage(imageHash) {
    if (!imageHash) return false;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin.from('orders').select('id').eq('image_hash', imageHash).gte('created_at', oneDayAgo).limit(1);
    if (error) return false;
    return data && data.length > 0;
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
    if (req.session.isAdmin) next();
    else res.status(401).json({ success: false, error: 'Unauthorized' });
}

// ==================== ADD NOTIFICATION ====================
async function addNotificationToDatabase(order) {
    try {
        const { error } = await supabaseAdmin.from('admin_notifications').insert([{
            order_id: order.id,
            title: `🆕 New Order #${order.id}`,
            message: `${order.plan} - ${order.price.toLocaleString()} MMK from ${maskPhone(order.phone)}`,
            is_read: false,
            created_at: new Date().toISOString()
        }]);
        if (error) {
            console.error('Error saving notification:', error);
        } else {
            console.log(`✅ Notification saved for order #${order.id}`);
        }
    } catch (e) { 
        console.error('Error in addNotificationToDatabase:', e); 
    }
}

async function autoCleanupOldOrders() {
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
    } catch (e) { console.error('Auto cleanup failed:', e); }
}

setTimeout(autoCleanupOldOrders, 5000);
setInterval(autoCleanupOldOrders, 24 * 60 * 60 * 1000);

// ==================== LIVE SYSTEM ====================
let liveClients = [];

app.get('/api/live/events', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*' });
    const clientId = Date.now();
    liveClients.push({ id: clientId, res });
    req.on('close', () => { liveClients = liveClients.filter(client => client.id !== clientId); });
});

async function broadcastNewOrder(order) {
    const message = `data: ${JSON.stringify({ type: 'new_order', order })}\n\n`;
    liveClients.forEach(client => { try { client.res.write(message); } catch(e) {} });
}

app.get('/api/payment-methods', (req, res) => { res.json({ methods: PAYMENT_METHODS }); });

// ==================== STATIC ROUTES ====================
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
app.get('/admin.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'admin.html')); });
app.get('/admin-chat.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'admin-chat.html')); });
app.get('/chat.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'chat.html')); });
app.get('/dashboard.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'dashboard.html')); });
app.get('/market.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'market.html')); });
app.get('/plans-widget.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'plans-widget.html')); });
app.get('/sw.js', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'sw.js')); });
app.get('/css/notification.css', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'css', 'notification.css')); });
app.get('/js/notifications.js', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'js', 'notifications.js')); });
app.get('/js/sales-hours.js', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'js', 'sales-hours.js')); });
app.get('/js/ad-widget.js', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'js', 'ad-widget.js')); });
app.get('/js/user-chat.js', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'js', 'user-chat.js')); });
app.get('/api/health', (req, res) => { res.json({ status: 'ok', timestamp: new Date().toISOString() }); });

// ==================== USER REGISTRATION ====================
app.post('/api/user/register', async (req, res) => {
    try {
        const { phone, username } = req.body;
        const { error: phoneError } = phoneSchema.validate(phone);
        if (phoneError) return res.status(400).json({ success: false, error: 'Invalid phone number format' });
        const { error: usernameError } = usernameSchema.validate(username);
        if (usernameError) return res.status(400).json({ success: false, error: 'Invalid username format' });
        let user = await getUserByPhone(phone);
        let isNewUser = false;
        if (!user) { user = await createNewUser(phone, username); isNewUser = true; }
        if (!user) return res.status(500).json({ success: false, error: 'Failed to create user' });
        if (user.blocked) return res.status(403).json({ success: false, error: 'Your account has been blocked' });
        res.json({ success: true, user: { phone: user.phone, username: user.username, user_id: user.user_id, order_count: user.order_count, blocked: user.blocked }, isNewUser: isNewUser });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/user/:phone', async (req, res) => {
    try {
        const { phone } = req.params;
        const user = await getUserByPhone(phone);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        res.json({ success: true, user: { phone: user.phone, username: user.username, user_id: user.user_id, order_count: user.order_count, blocked: user.blocked } });
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
        if (!name || !price) return res.status(400).json({ success: false, error: 'Name and price are required' });
        const { data, error } = await supabase.from('market_products').insert([{ name, price: parseInt(price), image: image || null, category: category || 'Uncategorized', icon: icon || 'fas fa-box', discount: discount || 0, created_at: new Date().toISOString() }]).select();
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
        if (!name || !price) return res.status(400).json({ success: false, error: 'Name and price are required' });
        const { data, error } = await supabase.from('market_products').update({ name, price: parseInt(price), image: image || null, category: category || 'Uncategorized', icon: icon || 'fas fa-box', discount: discount || 0, updated_at: new Date().toISOString() }).eq('id', parseInt(id)).select();
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
        if (!phone || phone === 'null' || phone === 'undefined') return res.status(400).json({ orders: [], error: 'Invalid phone number' });
        const { data, error } = await supabase.from('orders').select('*').eq('phone', phone).order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ orders: data || [] });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ orders: [], error: error.message });
    }
});

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
        if (!phone || phone === 'null' || phone === 'undefined') return res.status(400).json({ orders: [], error: 'Invalid phone number' });
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
        if (!canPlaceOrder()) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(403).json({ success: false, error: getStatusMessage(), isOpen: false, mode: salesHours.mode });
        }
        const { phone, plan, price, sender_name, last5_digits, payment_method } = req.body;
        const slipFile = req.file;
        const { error } = orderSchema.validate({ phone, plan, price, payment_method });
        if (error) { if (slipFile) fs.unlinkSync(slipFile.path); return res.status(400).json({ success: false, error: error.message }); }
        const blocked = await isPhoneBlocked(phone);
        if (blocked) { if (slipFile) fs.unlinkSync(slipFile.path); return res.status(403).json({ success: false, error: 'This phone number has been blocked.' }); }
        if (!checkRateLimit(phone)) { if (slipFile) fs.unlinkSync(slipFile.path); return res.status(429).json({ success: false, error: 'Too many orders. Please wait a moment.' }); }
        const duplicate = await isDuplicateOrder(phone, plan);
        if (duplicate) { if (slipFile) fs.unlinkSync(slipFile.path); return res.status(409).json({ success: false, error: 'Duplicate order detected. Please wait 5 minutes.' }); }
        let slipUrl = null, imageHash = null;
        if (slipFile) {
            const processedPath = await processImage(slipFile.path);
            slipUrl = processedPath;
            const fileBuffer = fs.readFileSync(path.join(__dirname, slipUrl));
            imageHash = calculateImageHash(fileBuffer);
            const duplicateImage = await isDuplicateImage(imageHash);
            if (duplicateImage) { fs.unlinkSync(path.join(__dirname, slipUrl)); return res.status(409).json({ success: false, error: 'Duplicate screenshot detected.' }); }
        }
        const orderId = Date.now();
        const { error: insertError } = await supabase.from('orders').insert([{ id: orderId, phone, plan, price: parseInt(price), status: 'Pending', slip_url: slipUrl, image_hash: imageHash, sender_name: sender_name || null, last5_digits: last5_digits || null, payment_method: payment_method || 'kpay', created_at: new Date().toISOString() }]);
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

// ==================== ADMIN API ====================
app.get('/api/admin/orders', isAuthenticated, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin.from('orders').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ orders: data || [] });
    } catch (error) {
        console.error('Error fetching all orders:', error);
        res.status(500).json({ orders: [], error: error.message });
    }
});

// ==================== GET APPROVED ORDER COUNTS BY PLAN ====================
app.get('/api/orders/approved-counts', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('orders')
            .select('plan, status')
            .eq('status', 'Approved');
        
        if (error) throw error;
        
        const counts = {
            "VIP LEVEL - 1": 0,
            "VIP LEVEL - 2": 0,
            "VIP LEVEL - 3": 0,
            "VIP LEVEL - 4 (ULTRA)": 0
        };
        
        data.forEach(order => {
            if (counts[order.plan] !== undefined) {
                counts[order.plan] += 1;
            }
        });
        
        res.json({ success: true, counts });
    } catch(e) {
        console.error('Error getting approved counts:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/admin/user-stats', isAuthenticated, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin.from('user_stats').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ stats: data || [] });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({ stats: [], error: error.message });
    }
});

app.get('/api/admin/suspect-users', isAuthenticated, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin.from('user_stats').select('*').eq('suspect_flag', true).order('reject_count', { ascending: false });
        if (error) throw error;
        res.json({ success: true, users: data || [] });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.get('/api/admin/blocked-users', isAuthenticated, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin.from('user_stats').select('*').eq('blocked', true).order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, users: data || [] });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.get('/api/admin/search-users', isAuthenticated, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.trim() === '') return res.json({ success: true, users: [] });
        const { data, error } = await supabaseAdmin.from('user_stats').select('*').or(`phone.ilike.%${q}%,username.ilike.%${q}%,user_id.ilike.%${q}%`).order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, users: data || [] });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ==================== DATABASE NOTIFICATIONS ====================
app.get('/api/admin/notifications', isAuthenticated, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin.from('admin_notifications').select('*').order('created_at', { ascending: false }).limit(100);
        if (error) throw error;
        res.json({ success: true, notifications: data || [] });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/api/admin/notifications/clear', isAuthenticated, async (req, res) => {
    try { const { error } = await supabaseAdmin.from('admin_notifications').delete().neq('id', 0); if (error) throw error; res.json({ success: true }); } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.delete('/api/admin/notifications/:id', isAuthenticated, async (req, res) => {
    try { const { id } = req.params; const { error } = await supabaseAdmin.from('admin_notifications').delete().eq('id', id); if (error) throw error; res.json({ success: true }); } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.put('/api/admin/notifications/:id/read', isAuthenticated, async (req, res) => {
    try { const { id } = req.params; const { error } = await supabaseAdmin.from('admin_notifications').update({ is_read: true }).eq('id', id); if (error) throw error; res.json({ success: true }); } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.put('/api/admin/notifications/read-all', isAuthenticated, async (req, res) => {
    try { const { error } = await supabaseAdmin.from('admin_notifications').update({ is_read: true }).neq('id', 0); if (error) throw error; res.json({ success: true }); } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.get('/api/admin/notifications/unread-count', isAuthenticated, async (req, res) => {
    try { const { count, error } = await supabaseAdmin.from('admin_notifications').select('*', { count: 'exact', head: true }).eq('is_read', false); if (error) throw error; res.json({ success: true, unreadCount: count || 0 }); } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ==================== ADMIN USER MANAGEMENT ====================
app.post('/api/admin/user-block', isAuthenticated, async (req, res) => {
    try { const { phone, block } = req.body; if (!phone) return res.status(400).json({ success: false, error: 'Phone required' }); await supabaseAdmin.from('user_stats').update({ blocked: block, updated_at: new Date().toISOString() }).eq('phone', phone); res.json({ success: true }); } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/api/admin/clear-suspect', isAuthenticated, async (req, res) => {
    try { const { phone } = req.body; if (!phone) return res.status(400).json({ success: false, error: 'Phone required' }); await supabaseAdmin.from('user_stats').update({ suspect_flag: false, updated_at: new Date().toISOString() }).eq('phone', phone); res.json({ success: true }); } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/api/admin/user-delete', isAuthenticated, async (req, res) => {
    try { const { phone } = req.body; if (!phone) return res.status(400).json({ success: false, error: 'Phone required' }); await supabaseAdmin.from('user_stats').delete().eq('phone', phone); res.json({ success: true }); } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/api/admin/user-delete-orders', isAuthenticated, async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ success: false, error: 'Phone required' });
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
        res.json({ success: true });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
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
        res.json({ success: true });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.put('/api/admin/orders/:id/approve', isAuthenticated, async (req, res) => {
    try { const { id } = req.params; await supabaseAdmin.from('orders').update({ status: 'Approved', activated_at: new Date().toISOString() }).eq('id', id); res.json({ success: true }); } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.put('/api/admin/orders/:id/reject', isAuthenticated, async (req, res) => {
    try { const { id } = req.params; const { data: order } = await supabaseAdmin.from('orders').select('phone').eq('id', id).single(); await supabaseAdmin.from('orders').update({ status: 'Rejected' }).eq('id', id); if (order) await updateUserStats(order.phone, true); res.json({ success: true }); } catch (error) { res.status(500).json({ success: false, error: error.message }); }
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
        res.json({ success: true });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ==================== ADMIN LOGIN ====================
app.post('/api/admin/login', loginLimiter, async (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    if (password === adminPassword) { req.session.isAdmin = true; res.json({ success: true, message: 'Login successful' }); }
    else { res.status(401).json({ success: false, message: 'Invalid password' }); }
});

app.post('/api/admin/logout', (req, res) => { req.session.destroy(); res.json({ success: true, message: 'Logged out successfully' }); });

// ==================== SYSTEM RESET API ====================
app.post('/api/admin/system-reset', isAuthenticated, async (req, res) => {
    try {
        const { confirm, keepProducts } = req.body;
        if (confirm !== 'RESET_ALL_DATA') return res.status(400).json({ success: false, error: 'Please type "RESET_ALL_DATA" to confirm' });
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
        if (!keepProducts) await supabaseAdmin.from('market_products').delete().neq('id', 0);
        res.json({ success: true, message: 'System reset completed' });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/api/admin/user-reset/:phone', isAuthenticated, async (req, res) => {
    try {
        const { phone } = req.params;
        if (!phone) return res.status(400).json({ success: false, error: 'Phone required' });
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
        res.json({ success: true });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ==================== PUBLIC CHAT API (Global) ====================
app.get('/api/chat/messages', async (req, res) => {
    try {
        const { data, error } = await supabase.from('chat_messages').select('*').order('created_at', { ascending: true }).limit(200);
        if (error) throw error;
        res.json({ success: true, messages: data || [] });
    } catch (error) {
        console.error('Error fetching chat messages:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/chat/send', async (req, res) => {
    try {
        const { user_id, username, message } = req.body;
        
        if (!user_id || !message || message.trim() === '') {
            return res.status(400).json({ success: false, error: 'Invalid message' });
        }
        
        if (containsBadWords(message)) {
            return res.status(400).json({ 
                success: false, 
                error: 'သင့်စာတွင် မလျော်ကန်သော စကားလုံးများ ပါရှိပါသည်။ ကျေးဇူးပြု၍ လေးစားစွာ ပြောဆိုပါ။' 
            });
        }
        
        const { data, error } = await supabase.from('chat_messages').insert([{
            user_id: user_id,
            username: username || 'User',
            message: message.substring(0, 500),
            is_admin: false,
            created_at: new Date().toISOString()
        }]).select();
        
        if (error) throw error;
        
        res.json({ success: true, message: data[0] });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/chat/admin/send', isAuthenticated, async (req, res) => {
    try {
        const { user_id, username, message } = req.body;
        if (!message || message.trim() === '') return res.status(400).json({ success: false, error: 'Invalid message' });
        const { data, error } = await supabase.from('chat_messages').insert([{
            user_id: user_id || 'admin',
            username: username || 'Admin',
            message: message.substring(0, 500),
            is_admin: true,
            created_at: new Date().toISOString()
        }]).select();
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
        const { error } = await supabase.from('chat_messages').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== PRIVATE CHAT API (1-on-1) ====================

// Get admin users list (users who sent messages to admin)
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

// Get private messages between user and admin
app.get('/api/chat/private/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.query.currentUserId || 'admin';
        
        console.log(`🔍 Fetching private messages - userId: ${userId}, currentUserId: ${currentUserId}`);
        
        const { data, error } = await supabase
            .from('private_chat_messages')
            .select('*')
            .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUserId})`)
            .order('created_at', { ascending: true })
            .limit(200);
        
        if (error) throw error;
        
        console.log(`✅ Found ${data?.length || 0} private messages`);
        
        // Mark messages as read
        if (currentUserId === 'admin') {
            await supabase
                .from('private_chat_messages')
                .update({ is_read: true })
                .eq('sender_id', userId)
                .eq('receiver_id', 'admin')
                .eq('is_read', false);
        } else {
            await supabase
                .from('private_chat_messages')
                .update({ is_read: true })
                .eq('sender_id', 'admin')
                .eq('receiver_id', currentUserId)
                .eq('is_read', false);
        }
        
        res.json({ success: true, messages: data || [] });
    } catch (error) {
        console.error('Error fetching private messages:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send private message
app.post('/api/chat/private/send', async (req, res) => {
    try {
        const { sender_id, receiver_id, sender_name, receiver_name, message } = req.body;
        
        console.log(`📨 Sending private message - from: ${sender_id} (${sender_name}), to: ${receiver_id} (${receiver_name})`);
        console.log(`Message: ${message}`);
        
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
        
        if (error) {
            console.error('Database error:', error);
            throw error;
        }
        
        console.log(`✅ Private message saved successfully, ID: ${data[0]?.id}`);
        
        // Auto reply for user messages
        if (sender_id !== 'admin') {
            const isShopOpen = canPlaceOrder();
            const autoReply = getAutoReply(message, isShopOpen, sender_id);
            if (autoReply) {
                await sendAutoReply(sender_id, sender_name, autoReply);
            }
        }
        
        res.json({ success: true, message: data[0] });
    } catch (error) {
        console.error('Error sending private message:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ MARK MESSAGES AS READ ============
app.put('/api/chat/private/mark-read/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.query.currentUserId || 'admin';
        
        console.log(`📖 Marking messages as read - userId: ${userId}, currentUserId: ${currentUserId}`);
        
        const { error } = await supabase
            .from('private_chat_messages')
            .update({ is_read: true })
            .eq('sender_id', userId)
            .eq('receiver_id', currentUserId)
            .eq('is_read', false);
        
        if (error) throw error;
        
        res.json({ success: true, message: 'Messages marked as read' });
    } catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get unread count for user
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

// ==================== LANGUAGE SETTINGS API ====================
app.post('/api/chat/set-language', async (req, res) => {
    try {
        const { user_id, language } = req.body;
        if (user_id && ['my', 'en', 'zh'].includes(language)) {
            setUserLanguage(user_id, language);
            res.json({ success: true, message: `Language changed to ${language}` });
        } else {
            res.status(400).json({ success: false, error: 'Invalid language' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/chat/get-language/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const language = getUserLanguage(userId);
        res.json({ success: true, language: language });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ================================================================
//  PLANS API (Supabase) - Public
// ================================================================

// Get all plans (Public - for plans widget)
app.get('/api/plans', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('plans')
            .select('*')
            .order('id', { ascending: true });
        
        if (error) throw error;
        res.json({ success: true, plans: data || [] });
    } catch (error) {
        console.error('Error fetching plans:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get plans by operator (Public)
app.get('/api/plans/operator/:operator', async (req, res) => {
    try {
        const { operator } = req.params;
        const { data, error } = await supabase
            .from('plans')
            .select('*')
            .eq('operator', operator)
            .order('id', { ascending: true });
        
        if (error) throw error;
        res.json({ success: true, plans: data || [] });
    } catch (error) {
        console.error('Error fetching plans by operator:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ================================================================
//  PLANS API (Supabase) - Admin
// ================================================================

// Get all plans (Admin)
app.get('/api/admin/plans', isAuthenticated, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('plans')
            .select('*')
            .order('id', { ascending: true });
        
        if (error) throw error;
        res.json({ success: true, plans: data || [] });
    } catch (error) {
        console.error('Error fetching plans:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single plan by ID (Admin)
app.get('/api/admin/plans/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabaseAdmin
            .from('plans')
            .select('*')
            .eq('id', parseInt(id))
            .single();
        
        if (error) throw error;
        res.json({ success: true, plan: data });
    } catch (error) {
        console.error('Error fetching plan:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add new plan (Admin)
app.post('/api/admin/plans', isAuthenticated, async (req, res) => {
    try {
        const { name, price, icon, operator, features } = req.body;
        
        if (!name || !price || !operator) {
            return res.status(400).json({ 
                success: false, 
                error: 'Name, price and operator are required' 
            });
        }
        
        const { data, error } = await supabaseAdmin
            .from('plans')
            .insert([{
                name: name.trim(),
                price: parseInt(price),
                icon: icon || '📦',
                operator: operator,
                features: features || [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select();
        
        if (error) throw error;
        
        res.json({ success: true, plan: data[0] });
    } catch (error) {
        console.error('Error adding plan:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update plan (Admin)
app.put('/api/admin/plans/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, icon, operator, features } = req.body;
        
        if (!name || !price || !operator) {
            return res.status(400).json({ 
                success: false, 
                error: 'Name, price and operator are required' 
            });
        }
        
        const { data, error } = await supabaseAdmin
            .from('plans')
            .update({
                name: name.trim(),
                price: parseInt(price),
                icon: icon || '📦',
                operator: operator,
                features: features || [],
                updated_at: new Date().toISOString()
            })
            .eq('id', parseInt(id))
            .select();
        
        if (error) throw error;
        
        res.json({ success: true, plan: data[0] });
    } catch (error) {
        console.error('Error updating plan:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete plan (Admin)
app.delete('/api/admin/plans/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseAdmin
            .from('plans')
            .delete()
            .eq('id', parseInt(id));
        
        if (error) throw error;
        
        res.json({ success: true, message: 'Plan deleted successfully' });
    } catch (error) {
        console.error('Error deleting plan:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Sync default plans to Supabase (Admin)
app.post('/api/admin/plans/sync-default', isAuthenticated, async (req, res) => {
    try {
        const defaultPlans = [
            { name: "Atom Basic", price: 6000, icon: "📱", operator: "atom", features: [{ text: "6 GB ဒေတာ", type: "data" }, { text: "150 မိနစ်", type: "voice" }, { text: "600 SMS", type: "sms" }] },
            { name: "Atom Standard", price: 12000, icon: "📱", operator: "atom", features: [{ text: "20 GB ဒေတာ", type: "data" }, { text: "600 မိနစ်", type: "voice" }, { text: "2,500 SMS", type: "sms" }] },
            { name: "Atom Premium", price: 22000, icon: "📱", operator: "atom", features: [{ text: "50 GB ဒေတာ", type: "data" }, { text: "2,000 မိနစ်", type: "voice" }, { text: "6,000 SMS", type: "sms" }] },
            { name: "Atom Ultra", price: 38000, icon: "📱", operator: "atom", features: [{ text: "120 GB ဒေတာ", type: "data" }, { text: "အကန့်အသတ်မရှိ ခေါ်ဆိုမှု", type: "voice" }, { text: "12,000 SMS", type: "sms" }] },
            { name: "Mytel Basic", price: 5000, icon: "📶", operator: "mytel", features: [{ text: "5 GB ဒေတာ", type: "data" }, { text: "100 မိနစ်", type: "voice" }, { text: "500 SMS", type: "sms" }] },
            { name: "Mytel Standard", price: 10000, icon: "📶", operator: "mytel", features: [{ text: "15 GB ဒေတာ", type: "data" }, { text: "500 မိနစ်", type: "voice" }, { text: "2,000 SMS", type: "sms" }] },
            { name: "Mytel Premium", price: 20000, icon: "📶", operator: "mytel", features: [{ text: "40 GB ဒေတာ", type: "data" }, { text: "1,500 မိနစ်", type: "voice" }, { text: "5,000 SMS", type: "sms" }] },
            { name: "Mytel Ultra", price: 35000, icon: "📶", operator: "mytel", features: [{ text: "100 GB ဒေတာ", type: "data" }, { text: "အကန့်အသတ်မရှိ ခေါ်ဆိုမှု", type: "voice" }, { text: "10,000 SMS", type: "sms" }] },
            { name: "Ooredoo Basic", price: 5500, icon: "📳", operator: "ooredoo", features: [{ text: "5 GB ဒေတာ", type: "data" }, { text: "120 မိနစ်", type: "voice" }, { text: "550 SMS", type: "sms" }] },
            { name: "Ooredoo Standard", price: 11000, icon: "📳", operator: "ooredoo", features: [{ text: "18 GB ဒေတာ", type: "data" }, { text: "550 မိနစ်", type: "voice" }, { text: "2,200 SMS", type: "sms" }] },
            { name: "Ooredoo Premium", price: 21000, icon: "📳", operator: "ooredoo", features: [{ text: "45 GB ဒေတာ", type: "data" }, { text: "1,800 မိနစ်", type: "voice" }, { text: "5,500 SMS", type: "sms" }] },
            { name: "Ooredoo Ultra", price: 36000, icon: "📳", operator: "ooredoo", features: [{ text: "110 GB ဒေတာ", type: "data" }, { text: "အကန့်အသတ်မရှိ ခေါ်ဆိုမှု", type: "voice" }, { text: "10,000 SMS", type: "sms" }] },
            { name: "MPT Basic", price: 4500, icon: "📞", operator: "mpt", features: [{ text: "4 GB ဒေတာ", type: "data" }, { text: "80 မိနစ်", type: "voice" }, { text: "400 SMS", type: "sms" }] },
            { name: "MPT Standard", price: 9000, icon: "📞", operator: "mpt", features: [{ text: "12 GB ဒေတာ", type: "data" }, { text: "400 မိနစ်", type: "voice" }, { text: "1,800 SMS", type: "sms" }] },
            { name: "MPT Premium", price: 18000, icon: "📞", operator: "mpt", features: [{ text: "35 GB ဒေတာ", type: "data" }, { text: "1,200 မိနစ်", type: "voice" }, { text: "4,500 SMS", type: "sms" }] },
            { name: "MPT Ultra", price: 32000, icon: "📞", operator: "mpt", features: [{ text: "90 GB ဒေတာ", type: "data" }, { text: "အကန့်အသတ်မရှိ ခေါ်ဆိုမှု", type: "voice" }, { text: "8,000 SMS", type: "sms" }] }
        ];

        let inserted = 0;
        let errors = [];
        for (const plan of defaultPlans) {
            try {
                const { data, error } = await supabaseAdmin
                    .from('plans')
                    .insert([{
                        name: plan.name,
                        price: plan.price,
                        icon: plan.icon,
                        operator: plan.operator,
                        features: plan.features,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }])
                    .select();
                
                if (error) {
                    errors.push({ plan: plan.name, error: error.message });
                } else if (data) {
                    inserted++;
                }
            } catch (err) {
                errors.push({ plan: plan.name, error: err.message });
            }
        }

        res.json({ 
            success: true, 
            message: `Synced ${inserted} default plans to database`,
            inserted: inserted,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('Error syncing default plans:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ================================================================
//  START SERVER
// ================================================================

setInterval(() => {
    cleanupOldGlobalMessages();
}, 3 * 60 * 1000);
console.log('🔄 Global chat auto cleanup started (every 3 minutes)');

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
║     📋 Plan Management API: WORKING ✅                                   ║
║     🔄 Real-time Plan Sync: WORKING ✅                                   ║
║     🌍 Multi-Language Auto Reply: WORKING ✅                             ║
║     🧹 Global Chat Auto Cleanup (3 min): WORKING ✅                      ║
║     🚫 Bad Words Filter: WORKING ✅                                     ║
║     🔔 Unread Count (receiver only): WORKING ✅                          ║
║     📢 AD MANAGEMENT SYSTEM: WORKING ✅                                  ║
║     📖 Mark Messages as Read: WORKING ✅                                 ║
║     🕐 12-HOUR TIME FORMAT: WORKING ✅                                   ║
║                                                                          ║
║     🔒 SECURITY FEATURES ENABLED:                                        ║
║        ✅ Helmet.js (Security Headers)                                   ║
║        ✅ CSP with iframe support (UPDATED)                              ║
║        ✅ Google Fonts allowed                                           ║
║        ✅ CDN.jsdelivr + esm.sh allowed                                  ║
║        ✅ Rate Limiting                                                  ║
║        ✅ Sales Hours Control (Auto/Manual Mode)                        ║
║        ✅ Session-based Admin Auth                                       ║
║        ✅ Image Processing (Sharp)                                       ║
║        ✅ Database Notifications                                         ║
║        ✅ Private 1-on-1 Chat with Unread Counts                        ║
║        ✅ Mark as Read on view                                           ║
║        ✅ Multi-Language Auto Reply (my/en/zh)                          ║
║        ✅ Global Chat Auto Cleanup (every 3 minutes)                    ║
║        ✅ Bad Words Filter                                              ║
║        ✅ Ad Management System (ads table, rotation, tracking)          ║
║        ✅ Plan Management API (CRUD)                                    ║
║        ✅ Real-time Plan Sync via Supabase                              ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
    `);
});
