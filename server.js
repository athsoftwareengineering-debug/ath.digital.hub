// ============================================================
// ATH DIGITAL HUB - SERVER (Order ID starts from 1)
// ============================================================

const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { supabase, supabaseAdmin } = require('./database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ========== TRUST PROXY (for Render.com) ==========
app.set('trust proxy', 1);

// ========== SECURITY MIDDLEWARE ==========
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-hashes'", "cdnjs.cloudflare.com", "fonts.googleapis.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            fontSrc: ["'self'", "fonts.gstatic.com", "cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:", "i.postimg.cc", "*.supabase.co"],
            connectSrc: ["'self'", "*.supabase.co"],
        },
    },
}));

// ========== RATE LIMITING ==========
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, error: 'Too many requests. Please try again later.' }
});

const orderLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { success: false, error: 'Too many orders. Please wait a moment.' }
});

const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true,
    message: { success: false, error: 'Too many login attempts. Try again later.' }
});

app.use('/api/', globalLimiter);
app.use('/api/orders', orderLimiter);
app.use('/api/admin/login', adminLimiter);

// ========== STANDARD MIDDLEWARE ==========
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// ========== UPLOADS DIRECTORY (Keep for backward compatibility) ==========
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static('uploads'));

// ========== FILE UPLOAD CONFIGURATION (Memory Storage for Supabase) ==========
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    const allowedExt = ['.jpg', '.jpeg', '.png', '.webp'];
    
    const extname = allowedExt.includes(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedMimes.includes(file.mimetype);
    
    if (mimetype && extname) {
        cb(null, true);
    } else {
        cb(new Error('Only image files (JPEG, PNG, WEBP) are allowed!'));
    }
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: fileFilter
});

// ========== CRON JOB SECURITY ==========
const CRON_API_KEY = '21cef185318d538e47385bdd44d00e6231f59370fd792a6c5709f8d4aa48f82e';

// ========== ORDER ID GENERATOR (Start from 1 or continue from last) ==========
async function getNextOrderId() {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('id')
            .order('id', { ascending: false })
            .limit(1);
        
        if (error || !data || data.length === 0) {
            console.log('📝 No orders found - starting from ID 1');
            return 1;
        }
        
        const nextId = data[0].id + 1;
        console.log(`📝 Next order ID: ${nextId}`);
        return nextId;
    } catch (error) {
        console.error('Error getting next order ID:', error);
        return 1;
    }
}

// ========== SUPABASE STORAGE HELPERS ==========

async function uploadToSupabaseStorage(fileBuffer, originalName, mimetype) {
    try {
        const timestamp = Date.now();
        const random = Math.round(Math.random() * 1E9);
        const extension = path.extname(originalName);
        const fileName = `${timestamp}-${random}${extension}`;
        
        const { data, error } = await supabaseAdmin.storage
            .from('order-slips')
            .upload(fileName, fileBuffer, {
                contentType: mimetype,
                cacheControl: '3600'
            });
        
        if (error) throw error;
        
        const { data: urlData } = supabaseAdmin.storage
            .from('order-slips')
            .getPublicUrl(fileName);
        
        console.log(`✅ File uploaded to Supabase: ${urlData.publicUrl}`);
        return urlData.publicUrl;
        
    } catch (error) {
        console.error('Error uploading to Supabase Storage:', error);
        throw new Error('Failed to upload file to storage');
    }
}

async function deleteFromSupabaseStorage(fileUrl) {
    try {
        if (!fileUrl) return true;
        
        if (!fileUrl.includes('supabase.co')) {
            // Legacy local file
            if (fileUrl.startsWith('/uploads/')) {
                const filePath = path.join(__dirname, fileUrl);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`✅ Deleted local file: ${filePath}`);
                }
            }
            return true;
        }
        
        const urlParts = fileUrl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        
        const { error } = await supabaseAdmin.storage
            .from('order-slips')
            .remove([fileName]);
        
        if (error) {
            console.error('Storage delete error:', error);
            return false;
        }
        
        console.log(`✅ Deleted from Supabase: ${fileName}`);
        return true;
        
    } catch (error) {
        console.error('Error deleting from Supabase Storage:', error);
        return false;
    }
}

// ========== FRAUD DETECTION HELPERS ==========
function calculateImageHash(fileBuffer) {
    return crypto.createHash('md5').update(fileBuffer).digest('hex');
}

async function getUserStats(phone) {
    try {
        const { data, error } = await supabaseAdmin
            .from('user_stats')
            .select('*')
            .eq('phone', phone)
            .maybeSingle();
        
        if (error && error.code !== 'PGRST116') {
            console.error('Error getting user stats:', error);
        }
        return data;
    } catch (e) {
        return null;
    }
}

async function updateUserStats(phone, isRejected = false) {
    try {
        const existing = await getUserStats(phone);
        
        if (existing) {
            const updateData = {
                order_count: (existing.order_count || 0) + 1,
                updated_at: new Date().toISOString()
            };
            if (isRejected) {
                updateData.reject_count = (existing.reject_count || 0) + 1;
                const newRejectCount = (existing.reject_count || 0) + 1;
                const newOrderCount = (existing.order_count || 0) + 1;
                if (newOrderCount >= 5 && (newRejectCount / newOrderCount) > 0.5) {
                    updateData.suspect_flag = true;
                }
            }
            
            await supabaseAdmin
                .from('user_stats')
                .update(updateData)
                .eq('phone', phone);
        } else {
            await supabaseAdmin
                .from('user_stats')
                .insert([{
                    phone: phone,
                    order_count: 1,
                    reject_count: isRejected ? 1 : 0,
                    suspect_flag: false,
                    blocked: false
                }]);
        }
    } catch (e) {
        console.error('Error updating user stats:', e);
    }
}

async function isPhoneBlocked(phone) {
    const stats = await getUserStats(phone);
    return stats?.blocked === true;
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
    } catch (e) {
        return false;
    }
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
    } catch (e) {
        return false;
    }
}

const orderRateLimit = new Map();
function checkRateLimit(phone) {
    const now = Date.now();
    const userOrders = orderRateLimit.get(phone) || [];
    const recentOrders = userOrders.filter(time => now - time < 60 * 1000);
    
    if (recentOrders.length >= 3) {
        return false;
    }
    
    recentOrders.push(now);
    orderRateLimit.set(phone, recentOrders);
    return true;
}

// ========== TARGET-BASED STORAGE CLEANUP (CORE FUNCTION) ==========
async function targetedStorageCleanup() {
    console.log('🗑️ Starting targeted storage cleanup...');
    console.log(`📅 Time: ${new Date().toISOString()}`);
    const startTime = Date.now();
    
    try {
        const now = new Date();
        
        const retentionDays = {
            'Approved': 60,
            'Rejected': 30,
            'Pending': 14
        };
        
        let totalDeletedOrders = 0;
        let totalDeletedFiles = 0;
        
        for (const [status, days] of Object.entries(retentionDays)) {
            const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
            
            const { data: oldOrders } = await supabaseAdmin
                .from('orders')
                .select('id, slip_url, status, created_at')
                .eq('status', status)
                .lt('created_at', cutoffDate);
            
            if (oldOrders && oldOrders.length > 0) {
                console.log(`📋 Status: ${status} | Older than ${days} days: ${oldOrders.length} orders`);
                
                for (const order of oldOrders) {
                    if (order.slip_url) {
                        const deleted = await deleteFromSupabaseStorage(order.slip_url);
                        if (deleted) totalDeletedFiles++;
                    }
                }
                
                const { error } = await supabaseAdmin
                    .from('orders')
                    .delete()
                    .eq('status', status)
                    .lt('created_at', cutoffDate);
                
                if (error) throw error;
                
                totalDeletedOrders += oldOrders.length;
            } else {
                console.log(`📋 Status: ${status} | No orders older than ${days} days`);
            }
        }
        
        const duration = Date.now() - startTime;
        console.log(`✅ Targeted cleanup completed in ${duration}ms`);
        console.log(`   📊 Deleted orders: ${totalDeletedOrders}`);
        console.log(`   🗑️ Deleted files: ${totalDeletedFiles}`);
        
        return { 
            success: true,
            deletedOrders: totalDeletedOrders, 
            deletedFiles: totalDeletedFiles, 
            duration,
            retentionApplied: retentionDays,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error('❌ Targeted cleanup failed:', error);
        throw error;
    }
}

// ========== INTERNAL ENDPOINT FOR CRON JOB ==========
app.post('/api/internal/targeted-cleanup', async (req, res) => {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey || apiKey !== CRON_API_KEY) {
        console.warn('❌ Unauthorized cron job attempt from IP:', req.ip);
        return res.status(401).json({ 
            success: false, 
            error: 'Unauthorized. Invalid or missing API key.' 
        });
    }
    
    console.log('🔐 Cron job authorized, starting targeted cleanup...');
    
    try {
        const result = await targetedStorageCleanup();
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ========== STATIC HTML ROUTES ==========
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ========== MAIN STORE - GET ALL ORDERS ==========
app.get('/api/orders', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        res.json({ orders: data || [] });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ orders: [], error: error.message });
    }
});

// ========== USER API - GET USER'S OWN ORDERS ==========
app.get('/api/orders/:phone', async (req, res) => {
    try {
        const { phone } = req.params;
        
        if (!phone || phone === 'null' || phone === 'undefined') {
            return res.status(400).json({ orders: [], error: 'Invalid phone number' });
        }
        
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('phone', phone)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        res.json({ orders: data || [] });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ orders: [], error: error.message });
    }
});

// ========== ADMIN API ==========
app.get('/api/admin/orders', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        res.json({ orders: data || [] });
    } catch (error) {
        console.error('Error fetching admin orders:', error);
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
        console.error('Error fetching user stats:', error);
        res.status(500).json({ stats: [], error: error.message });
    }
});

app.post('/api/admin/user-block', async (req, res) => {
    try {
        const { phone, block } = req.body;
        
        if (!phone) {
            return res.status(400).json({ success: false, error: 'Phone required' });
        }
        
        const { error } = await supabaseAdmin
            .from('user_stats')
            .update({ blocked: block, updated_at: new Date().toISOString() })
            .eq('phone', phone);
        
        if (error) throw error;
        res.json({ success: true, message: block ? 'User blocked' : 'User unblocked' });
    } catch (error) {
        console.error('Error blocking user:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/clear-suspect', async (req, res) => {
    try {
        const { phone } = req.body;
        
        if (!phone) {
            return res.status(400).json({ success: false, error: 'Phone required' });
        }
        
        const { error } = await supabaseAdmin
            .from('user_stats')
            .update({ suspect_flag: false, updated_at: new Date().toISOString() })
            .eq('phone', phone);
        
        if (error) throw error;
        res.json({ success: true, message: 'Suspect flag cleared' });
    } catch (error) {
        console.error('Error clearing suspect flag:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/user-delete', async (req, res) => {
    try {
        const { phone } = req.body;
        
        if (!phone) {
            return res.status(400).json({ success: false, error: 'Phone required' });
        }
        
        const { error } = await supabaseAdmin
            .from('user_stats')
            .delete()
            .eq('phone', phone);
        
        if (error) throw error;
        res.json({ success: true, message: 'User deleted from stats' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/user-delete-orders', async (req, res) => {
    try {
        const { phone } = req.body;
        
        if (!phone) {
            return res.status(400).json({ success: false, error: 'Phone required' });
        }
        
        const { data: orders } = await supabaseAdmin
            .from('orders')
            .select('slip_url')
            .eq('phone', phone);
        
        if (orders && orders.length > 0) {
            for (const order of orders) {
                if (order.slip_url) {
                    await deleteFromSupabaseStorage(order.slip_url);
                }
            }
        }
        
        const { error } = await supabaseAdmin
            .from('orders')
            .delete()
            .eq('phone', phone);
        
        if (error) throw error;
        res.json({ success: true, message: `Deleted ${orders?.length || 0} orders for ${phone}` });
    } catch (error) {
        console.error('Error deleting user orders:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/cleanup-old', async (req, res) => {
    try {
        const result = await targetedStorageCleanup();
        res.json({ success: true, message: `Deleted ${result.deletedOrders} orders`, result });
    } catch (error) {
        console.error('Error during manual cleanup:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== CREATE ORDER (WITH SUPABASE STORAGE & SEQUENTIAL ID) ==========
app.post('/api/orders', upload.single('slip'), [
    body('phone').isMobilePhone().withMessage('Invalid phone number'),
    body('plan').notEmpty().withMessage('Plan is required'),
    body('price').isInt({ min: 1000, max: 100000 }).withMessage('Invalid price'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    try {
        const { phone, plan, price } = req.body;
        const slipFile = req.file;
        
        console.log(`📝 Creating order: phone=${phone}, plan=${plan}, price=${price}`);
        
        if (!phone || !plan || !price) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        const blocked = await isPhoneBlocked(phone);
        if (blocked) {
            return res.status(403).json({ success: false, error: 'This phone number has been blocked. Contact admin for support.' });
        }
        
        if (!checkRateLimit(phone)) {
            return res.status(429).json({ success: false, error: 'Too many orders. Please wait a moment.' });
        }
        
        const duplicate = await isDuplicateOrder(phone, plan);
        if (duplicate) {
            return res.status(409).json({ success: false, error: 'Duplicate order detected. Please wait 5 minutes.' });
        }
        
        let slipUrl = null;
        let imageHash = null;
        
        if (slipFile) {
            imageHash = calculateImageHash(slipFile.buffer);
            
            const duplicateImage = await isDuplicateImage(imageHash);
            if (duplicateImage) {
                return res.status(409).json({ success: false, error: 'Duplicate screenshot detected. Please use a new screenshot.' });
            }
            
            slipUrl = await uploadToSupabaseStorage(
                slipFile.buffer,
                slipFile.originalname,
                slipFile.mimetype
            );
        }
        
        // Get sequential order ID (1, 2, 3, 4...)
        const orderId = await getNextOrderId();
        
        const { error } = await supabase
            .from('orders')
            .insert([{
                id: orderId,
                phone: phone,
                plan: plan,
                price: parseInt(price),
                status: 'Pending',
                slip_url: slipUrl,
                image_hash: imageHash
            }]);
        
        if (error) throw error;
        
        await updateUserStats(phone, false);
        
        console.log(`✅ Order created: ${orderId}`);
        res.json({ 
            success: true, 
            orderId: orderId,
            message: 'Order created successfully'
        });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== ADMIN - Approve/Reject/Delete ==========
app.put('/api/admin/orders/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { error } = await supabaseAdmin
            .from('orders')
            .update({ 
                status: 'Approved', 
                activated_at: new Date().toISOString() 
            })
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true, message: 'Order approved successfully' });
    } catch (error) {
        console.error('Error approving order:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/admin/orders/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data: order } = await supabaseAdmin
            .from('orders')
            .select('phone')
            .eq('id', id)
            .single();
        
        const { error } = await supabaseAdmin
            .from('orders')
            .update({ status: 'Rejected' })
            .eq('id', id);
        
        if (error) throw error;
        
        if (order) {
            await updateUserStats(order.phone, true);
        }
        
        res.json({ success: true, message: 'Order rejected successfully' });
    } catch (error) {
        console.error('Error rejecting order:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/admin/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data: order } = await supabaseAdmin
            .from('orders')
            .select('slip_url')
            .eq('id', id)
            .single();
        
        if (order && order.slip_url) {
            await deleteFromSupabaseStorage(order.slip_url);
        }
        
        const { error } = await supabaseAdmin
            .from('orders')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true, message: 'Order deleted successfully' });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== ADMIN LOGIN ==========
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid password' });
    }
});

app.use('/uploads', express.static('uploads'));

// ========== START SERVER ==========
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📱 User Store: http://localhost:${PORT}/index.html`);
    console.log(`👨‍💼 Admin Panel: http://localhost:${PORT}/admin.html`);
    console.log(`☁️ Using Supabase Storage for file uploads`);
    console.log(`🔢 Order ID: Sequential (1, 2, 3, 4...)`);
    console.log(`🎯 Target-Based Cleanup:`);
    console.log(`   - Approved: 60 days`);
    console.log(`   - Rejected: 30 days`);
    console.log(`   - Pending: 14 days`);
});
