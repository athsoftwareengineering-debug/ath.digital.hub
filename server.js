// server.js - Express Server
const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const { supabase, supabaseAdmin } = require('./database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static('uploads'));

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
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
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
});

// ==================== HELPER FUNCTIONS ====================

// Calculate image hash (MD5)
function calculateImageHash(fileBuffer) {
    return crypto.createHash('md5').update(fileBuffer).digest('hex');
}

// Get user stats
async function getUserStats(phone) {
    const { data, error } = await supabaseAdmin
        .from('user_stats')
        .select('*')
        .eq('phone', phone)
        .single();
    
    if (error && error.code !== 'PGRST116') {
        console.error('Error getting user stats:', error);
    }
    
    return data;
}

// Create or update user stats
async function updateUserStats(phone, isRejected = false) {
    const existing = await getUserStats(phone);
    
    if (existing) {
        const updateData = {
            order_count: (existing.order_count || 0) + 1,
            updated_at: new Date().toISOString()
        };
        if (isRejected) {
            updateData.reject_count = (existing.reject_count || 0) + 1;
            // Auto suspect if reject rate > 50% and more than 5 orders
            const newRejectCount = (existing.reject_count || 0) + 1;
            const newOrderCount = (existing.order_count || 0) + 1;
            if (newOrderCount >= 5 && (newRejectCount / newOrderCount) > 0.5) {
                updateData.suspect_flag = true;
            }
        }
        
        const { error } = await supabaseAdmin
            .from('user_stats')
            .update(updateData)
            .eq('phone', phone);
        
        if (error) console.error('Error updating user stats:', error);
    } else {
        const { error } = await supabaseAdmin
            .from('user_stats')
            .insert([{
                phone: phone,
                order_count: 1,
                reject_count: isRejected ? 1 : 0,
                suspect_flag: false,
                blocked: false
            }]);
        
        if (error) console.error('Error creating user stats:', error);
    }
}

// Check if phone is blocked
async function isPhoneBlocked(phone) {
    const stats = await getUserStats(phone);
    return stats?.blocked === true;
}

// Check for duplicate order (same phone + plan within 5 minutes)
async function isDuplicateOrder(phone, plan) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
        .from('orders')
        .select('id')
        .eq('phone', phone)
        .eq('plan', plan)
        .gte('created_at', fiveMinutesAgo)
        .limit(1);
    
    if (error) {
        console.error('Error checking duplicate order:', error);
        return false;
    }
    return data && data.length > 0;
}

// Check for duplicate image hash
async function isDuplicateImage(imageHash) {
    if (!imageHash) return false;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
        .from('orders')
        .select('id')
        .eq('image_hash', imageHash)
        .gte('created_at', oneDayAgo)
        .limit(1);
    
    if (error) {
        console.error('Error checking duplicate image:', error);
        return false;
    }
    return data && data.length > 0;
}

// Rate limiting (3 orders per minute per phone)
const orderRateLimit = new Map();
function checkRateLimit(phone) {
    const now = Date.now();
    const userOrders = orderRateLimit.get(phone) || [];
    const recentOrders = userOrders.filter(time => now - time < 60 * 1000);
    
    if (recentOrders.length >= 3) {
        return false; // Rate limit exceeded
    }
    
    recentOrders.push(now);
    orderRateLimit.set(phone, recentOrders);
    return true;
}

// ==================== STATIC HTML ROUTES ====================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== USER API - Track Order by Phone ====================
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
        
        if (error) {
            return res.status(500).json({ orders: [], error: error.message });
        }
        
        res.json({ orders: data || [] });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ orders: [], error: error.message });
    }
});

// ==================== ADMIN API - Get All Orders ====================
app.get('/api/admin/orders', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            return res.status(500).json({ orders: [], error: error.message });
        }
        
        res.json({ orders: data || [] });
    } catch (error) {
        console.error('Error fetching all orders:', error);
        res.status(500).json({ orders: [], error: error.message });
    }
});

// ==================== ADMIN API - Get User Stats ====================
app.get('/api/admin/user-stats', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('user_stats')
            .select('*')
            .order('order_count', { ascending: false });
        
        if (error) {
            return res.status(500).json({ stats: [], error: error.message });
        }
        
        res.json({ stats: data || [] });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({ stats: [], error: error.message });
    }
});

// ==================== ADMIN API - Block/Unblock User ====================
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
        
        if (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
        
        res.json({ success: true, message: block ? 'User blocked' : 'User unblocked' });
    } catch (error) {
        console.error('Error blocking user:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== ADMIN API - Clear Suspect Flag ====================
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
        
        if (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
        
        res.json({ success: true, message: 'Suspect flag cleared' });
    } catch (error) {
        console.error('Error clearing suspect flag:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== CREATE ORDER (with fraud detection) ====================
app.post('/api/orders', upload.single('slip'), async (req, res) => {
    try {
        const { phone, plan, price } = req.body;
        const slipFile = req.file;
        
        console.log(`📝 Creating order: phone=${phone}, plan=${plan}, price=${price}`);
        
        if (!phone || !plan || !price) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        // 1. Check if phone is blocked
        const blocked = await isPhoneBlocked(phone);
        if (blocked) {
            return res.status(403).json({ success: false, error: 'This phone number has been blocked. Contact admin for support.' });
        }
        
        // 2. Check rate limit (3 orders per minute)
        if (!checkRateLimit(phone)) {
            return res.status(429).json({ success: false, error: 'Too many orders. Please wait a moment.' });
        }
        
        // 3. Check duplicate order (same phone + plan within 5 minutes)
        const duplicate = await isDuplicateOrder(phone, plan);
        if (duplicate) {
            return res.status(409).json({ success: false, error: 'Duplicate order detected. Please wait 5 minutes before ordering again.' });
        }
        
        let slipUrl = null;
        let imageHash = null;
        
        if (slipFile) {
            slipUrl = `/uploads/${slipFile.filename}`;
            // Calculate image hash
            const fileBuffer = fs.readFileSync(slipFile.path);
            imageHash = calculateImageHash(fileBuffer);
            
            // 4. Check duplicate image hash
            const duplicateImage = await isDuplicateImage(imageHash);
            if (duplicateImage) {
                // Clean up uploaded file
                fs.unlinkSync(slipFile.path);
                return res.status(409).json({ success: false, error: 'Duplicate screenshot detected. Please use a new screenshot.' });
            }
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
                image_hash: imageHash
            }]);
        
        if (error) {
            console.error('Insert error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
        
        // Update user stats (successful order)
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

// ==================== ADMIN - Approve Order ====================
app.put('/api/admin/orders/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get order to update user stats if rejected before
        const { data: order } = await supabaseAdmin
            .from('orders')
            .select('phone')
            .eq('id', id)
            .single();
        
        const { error } = await supabaseAdmin
            .from('orders')
            .update({ 
                status: 'Approved', 
                activated_at: new Date().toISOString() 
            })
            .eq('id', id);
        
        if (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
        
        res.json({ success: true, message: 'Order approved successfully' });
    } catch (error) {
        console.error('Error approving order:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== ADMIN - Reject Order ====================
app.put('/api/admin/orders/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get order to update user stats
        const { data: order } = await supabaseAdmin
            .from('orders')
            .select('phone')
            .eq('id', id)
            .single();
        
        const { error } = await supabaseAdmin
            .from('orders')
            .update({ status: 'Rejected' })
            .eq('id', id);
        
        if (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
        
        // Update user stats with rejection
        if (order) {
            await updateUserStats(order.phone, true);
        }
        
        res.json({ success: true, message: 'Order rejected successfully' });
    } catch (error) {
        console.error('Error rejecting order:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== ADMIN - Delete Order ====================
app.delete('/api/admin/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { error } = await supabaseAdmin
            .from('orders')
            .delete()
            .eq('id', id);
        
        if (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
        
        res.json({ success: true, message: 'Order deleted successfully' });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== ADMIN - Login ====================
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid password' });
    }
});

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📱 User Store: http://localhost:${PORT}/index.html`);
    console.log(`👨‍💼 Admin Panel: http://localhost:${PORT}/admin.html`);
    console.log(`📁 Uploads folder: ${uploadsDir}`);
});
