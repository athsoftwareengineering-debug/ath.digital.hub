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
    console.log('📁 Uploads directory created');
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

// Payment methods configuration
const PAYMENT_METHODS = {
    kpay: {
        name: 'KBZ Pay',
        account_name: 'AUNG THU HTWE',
        account_number: '09789999368',
        icon: 'https://i.ibb.co/CpyBHvrS/1000011452.jpg'
    },
    wavepay: {
        name: 'WavePay',
        account_name: 'AUNG THU HTWE',
        account_number: '09789999368',
        icon: 'https://i.ibb.co/9990m00N/FB-IMG-1780586423015.jpg'
    },
    ayapay: {
        name: 'AYA Pay',
        account_name: 'AUNG THU HTWE',
        account_number: '09789999368',
        icon: 'https://i.ibb.co/rPzL2xm/aya-pay.jpg'
    }
};

// ==================== HELPER FUNCTIONS ====================

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
        console.error('Exception in getUserStats:', e);
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
                    blocked: false,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }]);
        }
        console.log(`📊 Updated stats for ${phone}: ${isRejected ? 'rejected' : 'new order'}`);
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

// Rate limiting map
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

// ==================== AUTO CLEANUP FUNCTION ====================
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
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log(`🗑 Deleted file: ${order.slip_url}`);
                    }
                }
            }
        }
        
        const { error } = await supabaseAdmin
            .from('orders')
            .delete()
            .in('status', ['Pending', 'Rejected'])
            .lt('created_at', thirtyDaysAgo);
        
        if (error) {
            console.error('Auto cleanup error:', error);
        } else {
            console.log(`✅ Auto cleanup completed at ${new Date().toISOString()} - Deleted ${ordersToDelete?.length || 0} old orders`);
        }
    } catch (e) {
        console.error('Auto cleanup failed:', e);
    }
}

setTimeout(autoCleanupOldOrders, 5000);
setInterval(autoCleanupOldOrders, 24 * 60 * 60 * 1000);

// ==================== LIVE SYSTEM - WebSocket Alternative (SSE) ====================
// Store connected clients for Server-Sent Events
let liveClients = [];

// SSE endpoint for live orders
app.get('/api/live/events', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });
    
    const clientId = Date.now();
    const newClient = { id: clientId, res };
    liveClients.push(newClient);
    
    console.log(`🔴 Live client connected: ${clientId}, total: ${liveClients.length}`);
    
    req.on('close', () => {
        liveClients = liveClients.filter(client => client.id !== clientId);
        console.log(`🔴 Live client disconnected: ${clientId}, total: ${liveClients.length}`);
    });
});

// Broadcast new order to all live clients
async function broadcastNewOrder(order) {
    const message = `data: ${JSON.stringify({ type: 'new_order', order })}\n\n`;
    liveClients.forEach(client => {
        try {
            client.res.write(message);
        } catch(e) {
            console.error('Error broadcasting to client:', e);
        }
    });
}

// Get payment methods
app.get('/api/payment-methods', (req, res) => {
    res.json({ methods: PAYMENT_METHODS });
});

// ==================== STATIC HTML ROUTES ====================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});
app.get('/dashboard_live.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard_live.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== MARKET API ====================
app.get('/api/market/products', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('market_products')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            return res.status(500).json({ products: [], error: error.message });
        }
        
        res.json({ products: data || [] });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ products: [], error: error.message });
    }
});

app.post('/api/market/products', async (req, res) => {
    try {
        const { name, price, image, category, icon, discount } = req.body;
        
        if (!name || !price) {
            return res.status(400).json({ success: false, error: 'Name and price are required' });
        }
        
        const { data, error } = await supabase
            .from('market_products')
            .insert([{
                name,
                price: parseInt(price),
                image: image || null,
                category: category || 'Uncategorized',
                icon: icon || 'fas fa-box',
                discount: discount || 0,
                created_at: new Date().toISOString()
            }])
            .select();
        
        if (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
        
        res.json({ success: true, product: data[0] });
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/market/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, image, category, icon, discount } = req.body;
        
        if (!name || !price) {
            return res.status(400).json({ success: false, error: 'Name and price are required' });
        }
        
        const { data, error } = await supabase
            .from('market_products')
            .update({
                name,
                price: parseInt(price),
                image: image || null,
                category: category || 'Uncategorized',
                icon: icon || 'fas fa-box',
                discount: discount || 0,
                updated_at: new Date().toISOString()
            })
            .eq('id', parseInt(id))
            .select();
        
        if (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
        
        res.json({ success: true, product: data[0] });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/market/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { error } = await supabase
            .from('market_products')
            .delete()
            .eq('id', parseInt(id));
        
        if (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
        
        res.json({ success: true, message: 'Product deleted' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== USER API ====================
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

// ==================== PUBLIC LIVE API (No Authentication Required) ====================
// Public endpoint for live orders - no admin authentication needed
app.get('/api/live/orders', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (error) {
            console.error('Error fetching live orders:', error);
            return res.status(500).json({ orders: [], error: error.message });
        }
        
        res.json({ orders: data || [] });
    } catch (error) {
        console.error('Error in live orders endpoint:', error);
        res.status(500).json({ orders: [], error: error.message });
    }
});

// Public endpoint for single order check (for search)
app.get('/api/live/order/:phone', async (req, res) => {
    try {
        const { phone } = req.params;
        
        if (!phone || phone === 'null' || phone === 'undefined') {
            return res.status(400).json({ orders: [], error: 'Invalid phone number' });
        }
        
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('phone', phone)
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (error) {
            return res.status(500).json({ orders: [], error: error.message });
        }
        
        res.json({ orders: data || [] });
    } catch (error) {
        console.error('Error fetching order by phone:', error);
        res.status(500).json({ orders: [], error: error.message });
    }
});

// ==================== CREATE ORDER ====================
app.post('/api/orders', upload.single('slip'), async (req, res) => {
    try {
        const { phone, plan, price, sender_name, last5_digits, payment_method } = req.body;
        const slipFile = req.file;
        
        console.log(`📝 Creating order: phone=${phone}, plan=${plan}, price=${price}, payment=${payment_method || 'kpay'}`);
        
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
            slipUrl = `/uploads/${slipFile.filename}`;
            const fileBuffer = fs.readFileSync(slipFile.path);
            imageHash = calculateImageHash(fileBuffer);
            
            const duplicateImage = await isDuplicateImage(imageHash);
            if (duplicateImage) {
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
                image_hash: imageHash,
                sender_name: sender_name || null,
                last5_digits: last5_digits || null,
                payment_method: payment_method || 'kpay',
                created_at: new Date().toISOString()
            }]);
        
        if (error) {
            console.error('Insert error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
        
        await updateUserStats(phone, false);
        
        // Get the created order for broadcast
        const { data: newOrder } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();
        
        // Broadcast to live clients
        if (newOrder) {
            await broadcastNewOrder(newOrder);
        }
        
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

// ==================== ADMIN API ====================
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
        
        if (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
        
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
                    const filePath = path.join(__dirname, order.slip_url);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                }
            }
        }
        
        const { error } = await supabaseAdmin
            .from('orders')
            .delete()
            .eq('phone', phone);
        
        if (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
        
        res.json({ success: true, message: `Deleted ${orders?.length || 0} orders for ${phone}` });
    } catch (error) {
        console.error('Error deleting user orders:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/cleanup-old', async (req, res) => {
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
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                }
            }
        }
        
        const { error } = await supabaseAdmin
            .from('orders')
            .delete()
            .in('status', ['Pending', 'Rejected'])
            .lt('created_at', thirtyDaysAgo);
        
        if (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
        
        res.json({ success: true, message: `Deleted ${ordersToDelete?.length || 0} old orders` });
    } catch (error) {
        console.error('Error during manual cleanup:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

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
        
        if (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
        
        console.log(`✅ Order ${id} approved`);
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
        
        if (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
        
        if (order) {
            await updateUserStats(order.phone, true);
        }
        
        console.log(`❌ Order ${id} rejected`);
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
            const filePath = path.join(__dirname, order.slip_url);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        
        const { error } = await supabaseAdmin
            .from('orders')
            .delete()
            .eq('id', id);
        
        if (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
        
        console.log(`🗑 Order ${id} deleted`);
        res.json({ success: true, message: 'Order deleted successfully' });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    if (password === adminPassword) {
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid password' });
    }
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║     🚀 ATH DIGITAL HUB SERVER STARTED                                    ║
║                                                                          ║
║     📱 User Store:      http://localhost:${PORT}/                         ║
║     👨‍💼 Admin Panel:     http://localhost:${PORT}/admin.html               ║
║     📊 Live Dashboard:  http://localhost:${PORT}/dashboard_live.html      ║
║     🔴 Live Events:     http://localhost:${PORT}/api/live/events          ║
║     📡 Public Live API: http://localhost:${PORT}/api/live/orders          ║
║     🔍 Search Live:     http://localhost:${PORT}/api/live/order/09xxxxxxx ║
║                                                                          ║
║     💳 Payment Methods:                                                  ║
║        - KBZ Pay (09789999368)                                           ║
║        - WavePay (09789999368)                                           ║
║        - AYA Pay (09789999368) 🆕                                        ║
║                                                                          ║
║     📁 Uploads folder:  ${uploadsDir}                                    ║
║     🗑️ Auto cleanup:    30 days for Pending/Rejected                     ║
║     🔴 Live clients:    ${liveClients.length} connected                   ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
    `);
});
