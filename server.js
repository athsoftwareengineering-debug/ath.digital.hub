// ============================================================
// ATH DIGITAL HUB - SERVER (Complete)
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

// ========== TRUST PROXY ==========
app.set('trust proxy', 1);

// ========== SECURITY MIDDLEWARE ==========
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https:", "fonts.googleapis.com", "cdnjs.cloudflare.com"],
            styleSrcElem: ["'self'", "'unsafe-inline'", "https:", "fonts.googleapis.com", "cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-hashes'", "https:", "cdnjs.cloudflare.com", "fonts.googleapis.com", "embed.tawk.to", "tawk.to", "blob:", "cdn.jsdelivr.net"],
            scriptSrcElem: ["'self'", "'unsafe-inline'", "https:", "cdnjs.cloudflare.com", "fonts.googleapis.com", "embed.tawk.to", "tawk.to", "blob:", "cdn.jsdelivr.net"],
            scriptSrcAttr: ["'unsafe-inline'"],
            fontSrc: ["'self'", "https:", "fonts.gstatic.com", "cdnjs.cloudflare.com", "data:"],
            imgSrc: ["'self'", "data:", "https:", "http:", "i.postimg.cc", "*.supabase.co", "blob:", "*.tawk.to"],
            connectSrc: ["'self'", "https:", "wss:", "*.supabase.co", "*.tawk.to", "ws://*.tawk.to", "wss://*.tawk.to", "https://va.tawk.to"],
            frameSrc: ["'self'", "*.tawk.to"],
            mediaSrc: ["'self'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: [],
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

// ========== UPLOADS DIRECTORY ==========
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static('uploads'));

// ========== FILE UPLOAD CONFIGURATION ==========
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

// ========== ORDER ID GENERATOR ==========
async function getNextOrderId() {
    try {
        const { count, error: countError } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true });
        
        if (countError) {
            console.error('Count error:', countError);
            return 1;
        }
        
        if (count === 0) {
            console.log('📝 No orders found - starting from ID 1');
            return 1;
        }
        
        const { data, error } = await supabase
            .from('orders')
            .select('id')
            .order('id', { ascending: false })
            .limit(1);
        
        if (error) {
            console.error('Max ID error:', error);
            return 1;
        }
        
        if (!data || data.length === 0) {
            return 1;
        }
        
        const maxId = data[0].id;
        const nextId = maxId + 1;
        
        console.log(`📝 Current max ID: ${maxId} → Next ID: ${nextId}`);
        return nextId;
        
    } catch (err) {
        console.error('❌ ID generation error:', err);
        return Math.floor(Date.now() / 1000);
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
            if (fileUrl.startsWith('/uploads/')) {
                const filePath = path.join(__dirname, fileUrl);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
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
        
        return true;
        
    } catch (error) {
        console.error('Error deleting from Supabase Storage:', error);
        return false;
    }
}

async function deleteAllStorageFiles() {
    try {
        const { data: files, error: listError } = await supabaseAdmin.storage
            .from('order-slips')
            .list();
        
        if (listError) {
            console.error('Error listing files:', listError);
            return 0;
        }
        
        if (!files || files.length === 0) {
            console.log('No files to delete in storage');
            return 0;
        }
        
        const fileNames = files.map(f => f.name);
        
        const { error: deleteError } = await supabaseAdmin.storage
            .from('order-slips')
            .remove(fileNames);
        
        if (deleteError) {
            console.error('Error deleting files:', deleteError);
            return 0;
        }
        
        console.log(`✅ Deleted ${fileNames.length} files from storage bucket`);
        return fileNames.length;
        
    } catch (error) {
        console.error('Error in deleteAllStorageFiles:', error);
        return 0;
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

// ========== TARGET-BASED STORAGE CLEANUP ==========
async function targetedStorageCleanup() {
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
            }
        }
        
        const duration = Date.now() - startTime;
        
        return { 
            success: true,
            deletedOrders: totalDeletedOrders, 
            deletedFiles: totalDeletedFiles, 
            duration,
            retentionApplied: retentionDays,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error('Targeted cleanup failed:', error);
        throw error;
    }
}

// ========== INTERNAL ENDPOINT FOR CRON JOB ==========
app.post('/api/internal/targeted-cleanup', async (req, res) => {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey || apiKey !== CRON_API_KEY) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }
    
    try {
        const result = await targetedStorageCleanup();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
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
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/cleanup-old', async (req, res) => {
    try {
        const result = await targetedStorageCleanup();
        res.json({ success: true, message: `Deleted ${result.deletedOrders} orders`, result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== ADMIN - SYSTEM RESET ==========
app.post('/api/admin/reset-system', async (req, res) => {
    const { password } = req.body;
    
    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, error: 'Invalid admin password' });
    }
    
    try {
        const storageFilesDeleted = await deleteAllStorageFiles();
        
        const { data: orders, error: ordersFetchError } = await supabaseAdmin
            .from('orders')
            .select('slip_url');
        
        if (ordersFetchError) throw ordersFetchError;
        
        let deletedFiles = storageFilesDeleted;
        
        if (orders && orders.length > 0) {
            for (const order of orders) {
                if (order.slip_url) {
                    const deleted = await deleteFromSupabaseStorage(order.slip_url);
                    if (deleted) deletedFiles++;
                }
            }
        }
        
        const { error: ordersError } = await supabaseAdmin
            .from('orders')
            .delete()
            .neq('id', 0);
        
        if (ordersError) throw ordersError;
        
        const { error: statsError } = await supabaseAdmin
            .from('user_stats')
            .delete()
            .neq('phone', '');
        
        if (statsError) throw statsError;
        
        res.json({ 
            success: true, 
            message: 'System reset completed',
            deletedOrders: orders?.length || 0,
            deletedFiles: deletedFiles
        });
        
    } catch (error) {
        console.error('System reset error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== CREATE ORDER ==========
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
        
        const orderId = await getNextOrderId();
        
        const { data, error } = await supabase
            .from('orders')
            .insert([{
                id: orderId,
                phone: phone,
                plan: plan,
                price: parseInt(price),
                status: 'Pending',
                slip_url: slipUrl,
                image_hash: imageHash
            }])
            .select();
        
        if (error) {
            console.error('Insert error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
        
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

// ========== CHAT API (Private Chat - Customer to Admin) ==========

// Get messages for a specific customer
app.get('/api/chat/messages/:phone', async (req, res) => {
    try {
        const { phone } = req.params;
        
        if (!phone || phone === 'null' || phone === 'undefined') {
            return res.status(400).json({ success: false, messages: [], error: 'Invalid phone' });
        }
        
        const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .or(`sender_id.eq.${phone},sender_id.eq.admin`)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        res.json({ success: true, messages: data || [] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send message (customer or admin)
app.post('/api/chat/send', async (req, res) => {
    try {
        const { sender_type, sender_id, sender_name, message } = req.body;
        
        if (!sender_type || !sender_id || !message) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        const { data, error } = await supabase
            .from('chat_messages')
            .insert([{
                sender_type: sender_type,
                sender_id: sender_id,
                sender_name: sender_name || (sender_type === 'admin' ? 'Admin' : sender_id),
                message: message,
                is_read: false
            }])
            .select();
        
        if (error) throw error;
        
        res.json({ success: true, message: data[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all messages for admin (grouped by customer)
app.get('/api/chat/admin/all', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        // Group by customer
        const customers = {};
        (data || []).forEach(msg => {
            if (msg.sender_type === 'customer') {
                if (!customers[msg.sender_id]) {
                    customers[msg.sender_id] = {
                        phone: msg.sender_id,
                        name: msg.sender_name,
                        messages: []
                    };
                }
                customers[msg.sender_id].messages.push(msg);
            } else if (msg.sender_type === 'admin') {
                // Add to last customer
                const lastCustomer = Object.values(customers).pop();
                if (lastCustomer) lastCustomer.messages.push(msg);
            }
        });
        
        res.json({ success: true, customers: customers });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mark messages as read
app.put('/api/chat/mark-read', async (req, res) => {
    try {
        const { sender_id } = req.body;
        
        const { error } = await supabase
            .from('chat_messages')
            .update({ is_read: true })
            .eq('is_read', false)
            .neq('sender_id', sender_id);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get unread count
app.get('/api/chat/unread-count', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('chat_messages')
            .select('id', { count: 'exact' })
            .eq('is_read', false)
            .eq('sender_type', 'customer');
        
        if (error) throw error;
        res.json({ success: true, count: data?.length || 0 });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.use('/uploads', express.static('uploads'));

// ========== START SERVER ==========
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Store: /index.html`);
    console.log(`👨‍💼 Admin: /admin.html`);
    console.log(`💬 Private Chat: Customer ↔ Admin`);
});
