const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.disable('x-powered-by');
app.use(morgan('combined'));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static folders
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
app.use(express.static(publicDir));

const uploadDir = path.join(__dirname, 'temp_uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/temp_uploads', express.static(uploadDir));

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + '.jpg')
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Admin password
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '104194@ath';

// In-memory storage
let orders = [];
let orderIdCounter = 1;

// ============ PUBLIC API ============

// Create order
app.post('/api/order', (req, res) => {
  const { packageName, price, phone, note, userId, userEmail, userName } = req.body;
  
  if (!packageName || !phone) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  
  const newOrder = {
    id: orderIdCounter++,
    orderId: 'ORD' + Date.now(),
    packageName,
    price: price || 0,
    phone,
    note: note || '',
    userId: userId || '',
    userEmail: userEmail || '',
    userName: userName || '',
    status: 'pending_payment',
    screenshotPath: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  orders.unshift(newOrder);
  console.log('✅ Order created:', newOrder.orderId, 'Phone:', phone);
  
  res.json({ success: true, orderId: newOrder.orderId });
});

// Submit payment with screenshot
app.post('/api/submit-payment', upload.single('screenshot'), (req, res) => {
  const { orderId, note } = req.body;
  
  if (!orderId) {
    return res.status(400).json({ success: false, message: 'Order ID required' });
  }
  
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Screenshot required' });
  }
  
  const order = orders.find(o => o.orderId === orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  
  order.screenshotPath = `/temp_uploads/${req.file.filename}`;
  order.status = 'payment_received';
  if (note) order.note = note;
  order.updatedAt = new Date().toISOString();
  
  console.log('💰 Payment received for:', order.orderId, 'Phone:', order.phone);
  
  res.json({ success: true, message: 'Payment submitted successfully' });
});

// Track orders by phone
app.get('/api/track', (req, res) => {
  const phone = req.query.phone;
  if (!phone) return res.json({ success: true, orders: [] });
  
  const userOrders = orders.filter(o => o.phone === phone);
  res.json({ success: true, orders: userOrders });
});

// Get user's own orders
app.get('/api/my-orders', (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.json({ success: true, orders: [] });
  
  const userOrders = orders.filter(o => o.userId === userId);
  res.json({ success: true, orders: userOrders });
});

// ============ ADMIN API ============

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: 'admin-token' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid password' });
  }
});

// Get all orders (admin)
app.get('/api/admin/orders', (req, res) => {
  const token = req.headers['x-admin-auth'];
  if (token !== 'admin-token') {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending_payment').length,
    paid: orders.filter(o => o.status === 'payment_received').length,
    approved: orders.filter(o => o.status === 'approved').length,
    rejected: orders.filter(o => o.status === 'rejected').length,
    expired: orders.filter(o => o.status === 'expired').length,
    revenue: orders.filter(o => o.status === 'approved').reduce((sum, o) => sum + (o.price || 0), 0)
  };
  
  res.json({ success: true, orders, stats });
});

// Update order status
app.post('/api/admin/update-order', (req, res) => {
  const token = req.headers['x-admin-auth'];
  if (token !== 'admin-token') {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  
  const { orderId, status, rejectReason } = req.body;
  const order = orders.find(o => o.id === orderId);
  
  if (order) {
    order.status = status;
    if (rejectReason) order.rejectReason = rejectReason;
    if (status === 'approved') {
      order.startDate = new Date().toISOString();
      order.endDate = new Date(Date.now() + 30 * 86400000).toISOString();
    }
    order.updatedAt = new Date().toISOString();
    console.log(`📦 Order #${orderId} status updated to: ${status}`);
  }
  
  res.json({ success: true });
});

// Delete order
app.post('/api/admin/delete-order', (req, res) => {
  const token = req.headers['x-admin-auth'];
  if (token !== 'admin-token') {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  
  const { orderId } = req.body;
  const order = orders.find(o => o.id === orderId);
  
  if (order && order.screenshotPath) {
    const filePath = path.join(__dirname, order.screenshotPath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  
  orders = orders.filter(o => o.id !== orderId);
  console.log(`🗑️ Order #${orderId} deleted`);
  
  res.json({ success: true });
});

// ============ FRONTEND ROUTES ============
app.get('/admin', (req, res) => {
  res.sendFile(path.join(publicDir, 'admin.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// ============ START SERVER ============
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║     🚀 MYTEL DATA SERVICE - SERVER STARTED          ║
╠══════════════════════════════════════════════════════╣
║  📱 User Dashboard: http://localhost:${PORT}/         ║
║  🔧 Admin Panel:    http://localhost:${PORT}/admin    ║
║  🔑 Admin Password: ${ADMIN_PASSWORD}                  ║
║  💾 Storage:        In-Memory (temp_uploads/)        ║
╚══════════════════════════════════════════════════════╝
  `);
});
