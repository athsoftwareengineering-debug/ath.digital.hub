// server.js - ATH DIGITAL HUB Main Server
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
require('dotenv').config();

// Import database and modules
const { 
    supabase, 
    supabaseAdmin, 
    createNewUser, 
    getUserByPhone, 
    getUserByUserId,
    updateUser,
    getAllUsers,
    searchUsers,
    isPhoneBlocked,
    updateUserStats
} = require('./database');

// Import routes
const chatRoutes = require('./routes/chat');
const adminRoutes = require('./routes/admin');
const marketRoutes = require('./routes/market');
const ordersRoutes = require('./routes/orders');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ MIDDLEWARE ============

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// CORS
app.use(cors({
    origin: ['http://localhost:3000', 'https://ath-digital-hub.onrender.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// Compression
app.use(compression());

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'ath-digital-hub-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { success: false, error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// ============ AUTHENTICATION MIDDLEWARE ============

function isAuthenticated(req, res, next) {
    if (req.session && req.session.isAdmin) {
        next();
    } else {
        res.status(401).json({ success: false, error: 'Unauthorized' });
    }
}

function isAdminAuthenticated(req, res, next) {
    const token = req.headers.authorization || req.cookies?.adminToken || req.session?.adminToken;
    if (token === 'logged_in' || (req.session && req.session.isAdmin)) {
        next();
    } else {
        res.status(401).json({ success: false, error: 'Unauthorized' });
    }
}

// ============ ROUTES ============

// Chat routes (Private & Global)
app.use('/api/chat', chatRoutes);

// Admin routes
app.use('/api/admin', adminRoutes);

// Market routes
app.use('/api/market', marketRoutes);

// Orders routes
app.use('/api/orders', ordersRoutes);

// ============ AUTH ROUTES ============

// Admin login
app.post('/api/admin/login', async (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    if (password === adminPassword) {
        req.session.isAdmin = true;
        req.session.adminToken = 'logged_in';
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ success: false, error: 'Invalid password' });
    }
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logged out' });
});

// Check admin session
app.get('/api/admin/check', (req, res) => {
    if (req.session && req.session.isAdmin) {
        res.json({ success: true, isAdmin: true });
    } else {
        res.json({ success: true, isAdmin: false });
    }
});

// ============ USER ROUTES ============

// Get or create user
app.post('/api/user/get-or-create', async (req, res) => {
    const { phone, username } = req.body;
    
    if (!phone) {
        return res.status(400).json({ success: false, error: 'Phone number required' });
    }
    
    try {
        let user = await getUserByPhone(phone);
        
        if (!user) {
            user = await createNewUser(phone, username || 'User');
        }
        
        if (user) {
            res.json({ 
                success: true, 
                user: {
                    user_id: user.user_id,
                    phone: user.phone,
                    username: user.username || username || 'User',
                    blocked: user.blocked || false
                }
            });
        } else {
            res.status(500).json({ success: false, error: 'Failed to create user' });
        }
    } catch (error) {
        console.error('Error in /user/get-or-create:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get user by ID
app.get('/api/user/:userId', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const user = await getUserByUserId(userId);
        
        if (user) {
            res.json({ success: true, user });
        } else {
            res.status(404).json({ success: false, error: 'User not found' });
        }
    } catch (error) {
        console.error('Error in /user/:userId:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ IMAGE UPLOAD ROUTES ============

// Upload payment slip
app.post('/api/upload/slip', upload.single('slip'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }
        
        // Optimize image with sharp
        const optimizedPath = path.join(uploadsDir, 'optimized-' + req.file.filename);
        await sharp(req.file.path)
            .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toFile(optimizedPath);
        
        // Replace original with optimized
        fs.unlinkSync(req.file.path);
        fs.renameSync(optimizedPath, req.file.path);
        
        const fileUrl = `/uploads/${req.file.filename}`;
        res.json({ success: true, fileUrl });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ SALES HOURS ROUTES ============

let salesHours = {
    enabled: true,
    startHour: 9,
    endHour: 21,
    mode: 'auto',
    manualStatus: true
};

// Get sales hours
app.get('/api/admin/sales-hours', isAdminAuthenticated, (req, res) => {
    res.json({ success: true, salesHours });
});

// Update sales hours
app.post('/api/admin/sales-hours', isAdminAuthenticated, (req, res) => {
    const { enabled, startHour, endHour, mode, manualStatus } = req.body;
    if (enabled !== undefined) salesHours.enabled = enabled;
    if (startHour !== undefined) salesHours.startHour = startHour;
    if (endHour !== undefined) salesHours.endHour = endHour;
    if (mode !== undefined) salesHours.mode = mode;
    if (manualStatus !== undefined) salesHours.manualStatus = manualStatus;
    res.json({ success: true, salesHours });
});

// Get sales status for users
app.get('/api/sales/status', (req, res) => {
    const now = new Date();
    const currentHour = now.getHours();
    let isOpen = false;
    let message = '';
    
    if (salesHours.mode === 'auto') {
        isOpen = salesHours.enabled && currentHour >= salesHours.startHour && currentHour < salesHours.endHour;
        message = isOpen 
            ? `🟢 ဆိုင်ဖွင့်ထားပါသည် (${salesHours.startHour}:00 - ${salesHours.endHour}:00)` 
            : `🔴 ဆိုင်ပိတ်ထားပါသည် (ဖွင့်ချိန် ${salesHours.startHour}:00 - ${salesHours.endHour}:00)`;
    } else {
        isOpen = salesHours.manualStatus;
        message = isOpen ? '🟢 ဆိုင်ဖွင့်ထားပါသည် (လက်ဖြင့်ထိန်းချုပ်ထား)' : '🔴 ဆိုင်ပိတ်ထားပါသည် (လက်ဖြင့်ထိန်းချုပ်ထား)';
    }
    
    res.json({ isOpen, message });
});

// ============ HTML ROUTES ============

// Serve main pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/admin-chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-chat.html'));
});

app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'chat.html'));
});

app.get('/market', (req, res) => {
    res.sendFile(path.join(__dirname, 'market.html'));
});

app.get('/live', (req, res) => {
    res.sendFile(path.join(__dirname, 'live.html'));
});

app.get('/dashboard-live', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard_live.html'));
});

// ============ ERROR HANDLING ============

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

// ============ START SERVER ============

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 URL: http://localhost:${PORT}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✅ Chat routes registered at /api/chat`);
    console.log(`✅ Admin routes registered at /api/admin`);
    console.log(`✅ Market routes registered at /api/market`);
    console.log(`✅ Orders routes registered at /api/orders`);
});

module.exports = app;
