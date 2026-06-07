const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const helmet = require('helmet');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');
const morgan = require('morgan');
const compression = require('compression');
const sharp = require('sharp');
const Joi = require('joi');
const { supabase, supabaseAdmin, createNewUser, getUserByPhone, getUserStats, updateUserStats, isPhoneBlocked } = require('./database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== VALIDATION SCHEMAS ====================
const phoneSchema = Joi.string().pattern(/^09[0-9]{7,9}$/).required();
const usernameSchema = Joi.string().min(2).max(50).pattern(/^[a-zA-Z0-9\u1000-\u109F\s]+$/).required();
const orderSchema = Joi.object({
    phone: phoneSchema,
    plan: Joi.string().valid('VIP LEVEL - 1', 'VIP LEVEL - 2', 'VIP LEVEL - 3', 'VIP LEVEL - 4 (ULTRA)').required(),
    price: Joi.number().valid(15000, 20000, 25000, 30000).required(),
    payment_method: Joi.string().valid('kpay', 'wavepay', 'ayapay').default('kpay')
});

// ==================== SECURITY MIDDLEWARE ====================
app.use(compression());
app.use(morgan('combined'));

// ==================== UPDATED CSP CONFIGURATION ====================
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
            scriptSrcAttr: ["'unsafe-inline'"],  // ✅ FIXED: Allows inline event handlers
            styleSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:", "i.ibb.co"],
            connectSrc: ["'self'", process.env.SUPABASE_URL],
            frameAncestors: ["'none'"],
            formAction: ["'self'"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// Additional security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
});

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX) || 5,
    message: { error: 'Too many login attempts, please try again later.' },
    skipSuccessfulRequests: true
});

const orderLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 3,
    message: { error: 'Too many orders. Please wait a moment.' },
    keyGenerator: (req) => req.body.phone || req.ip
});

// Session configuration
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
const csrfProtection = csrf({ cookie: true });

// CORS
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? process.env.ALLOWED_ORIGINS?.split(',') : '*',
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(__dirname));
app.use('/api/', apiLimiter);

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

// ==================== STATIC ROUTES ====================
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });
app.get('/admin.html', (req, res) => { res.sendFile(path.join(__dirname, 'admin.html')); });
app.get('/dashboard.html', (req, res) => { res.sendFile(path.join(__dirname, 'dashboard_live.html')); });
app.get('/api/health', (req, res) => { res.json({ status: 'ok', timestamp: new Date().toISOString() }); });
app.get('/api/csrf-token', csrfProtection, (req, res) => { res.json({ csrfToken: req.csrfToken() }); });

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
app.get('/api/market/products', async (req, res) => {
    try {
        const { data, error } = await supabase.from('market_products').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ products: data || [] });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ products: [], error: error.message });
    }
});

app.post('/api/market/products', isAuthenticated, csrfProtection, async (req, res) => {
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

app.put('/api/market/products/:id', isAuthenticated, csrfProtection, async (req, res) => {
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

app.delete('/api/market/products/:id', isAuthenticated, csrfProtection, async (req, res) => {
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
        if (newOrder) await broadcastNewOrder(newOrder);
        
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
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/admin/blocked-users', isAuthenticated, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin.from('user_stats').select('*').eq('blocked', true).order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, users: data || [] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/admin/search-users', isAuthenticated, async (req, res) => {
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

app.post('/api/admin/user-block', isAuthenticated, csrfProtection, async (req, res) => {
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

app.post('/api/admin/clear-suspect', isAuthenticated, csrfProtection, async (req, res) => {
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

app.post('/api/admin/user-delete', isAuthenticated, csrfProtection, async (req, res) => {
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

app.post('/api/admin/user-delete-orders', isAuthenticated, csrfProtection, async (req, res) => {
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

app.post('/api/admin/cleanup-old', isAuthenticated, csrfProtection, async (req, res) => {
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

app.put('/api/admin/orders/:id/approve', isAuthenticated, csrfProtection, async (req, res) => {
    try {
        const { id } = req.params;
        await supabaseAdmin.from('orders').update({ status: 'Approved', activated_at: new Date().toISOString() }).eq('id', id);
        res.json({ success: true, message: 'Order approved successfully' });
    } catch (error) {
        console.error('Error approving order:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/admin/orders/:id/reject', isAuthenticated, csrfProtection, async (req, res) => {
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

app.delete('/api/admin/orders/:id', isAuthenticated, csrfProtection, async (req, res) => {
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
app.post('/api/admin/system-reset', isAuthenticated, csrfProtection, async (req, res) => {
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

app.post('/api/admin/user-reset/:phone', isAuthenticated, csrfProtection, async (req, res) => {
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
        res.json({ success: true, message: `User ${phone} and all their data deleted successfully` });
    } catch (error) {
        console.error('Error deleting user data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║     🚀 ATH DIGITAL HUB SERVER STARTED (SECURE MODE)                     ║
║                                                                          ║
║     📱 User Store:      http://localhost:${PORT}/                         ║
║     👨‍💼 Admin Panel:     http://localhost:${PORT}/admin.html               ║
║     📊 Live Dashboard:  http://localhost:${PORT}/dashboard.html           ║
║                                                                          ║
║     🔒 SECURITY FEATURES ENABLED:                                        ║
║        ✅ Helmet.js (Security Headers)                                   ║
║        ✅ CSP with unsafe-inline (for admin panel)                       ║
║        ✅ Rate Limiting (100 requests/15min)                            ║
║        ✅ Login Rate Limiting (5 attempts/15min)                        ║
║        ✅ Order Rate Limiting (3 orders/min)                            ║
║        ✅ Session-based Admin Auth (HttpOnly Cookie)                    ║
║        ✅ CSRF Protection                                                ║
║        ✅ Input Validation (Joi)                                        ║
║        ✅ Image Processing (Sharp)                                      ║
║                                                                          ║
║     💳 Payment Methods: KBZ Pay, WavePay, AYA Pay                        ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
    `);
});
