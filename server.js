// server.js - Express Server
const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const { supabase, supabaseAdmin } = require('./database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================
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

// ============================================
// FILE UPLOAD CONFIGURATION
// ============================================
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

// ============================================
// STATIC HTML ROUTES
// ============================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// ============================================
// API ROUTES
// ============================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// USER API - Track Order by Phone
// ============================================
app.get('/api/orders/:phone', async (req, res) => {
    try {
        const { phone } = req.params;
        
        if (!phone) {
            return res.status(400).json({ success: false, error: 'Phone number is required' });
        }
        
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('phone', phone)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Supabase error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
        
        res.json({ success: true, orders: data || [] });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// ADMIN API - Get All Orders
// ============================================
app.get('/api/admin/orders', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Supabase admin error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
        
        res.json({ success: true, orders: data || [] });
    } catch (error) {
        console.error('Error fetching all orders:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// CREATE ORDER (with image upload)
// ============================================
app.post('/api/orders', upload.single('slip'), async (req, res) => {
    try {
        const { phone, plan, price } = req.body;
        const slipFile = req.file;
        
        if (!phone || !plan || !price) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        let slipUrl = null;
        if (slipFile) {
            slipUrl = `/uploads/${slipFile.filename}`;
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
                slip_url: slipUrl
            }]);
        
        if (error) {
            console.error('Insert error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
        
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

// ============================================
// ADMIN - Approve Order
// ============================================
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
        
        res.json({ success: true, message: 'Order approved successfully' });
    } catch (error) {
        console.error('Error approving order:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// ADMIN - Reject Order
// ============================================
app.put('/api/admin/orders/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { error } = await supabaseAdmin
            .from('orders')
            .update({ status: 'Rejected' })
            .eq('id', id);
        
        if (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
        
        res.json({ success: true, message: 'Order rejected successfully' });
    } catch (error) {
        console.error('Error rejecting order:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// ADMIN - Delete Order
// ============================================
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

// ============================================
// ADMIN - Login
// ============================================
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
