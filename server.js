require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const morgan = require('morgan');

const database = require('./database');
const app = express();

// Security
app.use(helmet({ contentSecurityPolicy: false }));
app.disable('x-powered-by');
app.use(morgan('combined'));

// Timezone
process.env.TZ = 'Asia/Yangon';
function getMyanmarTime12hr() {
  const now = new Date();
  return {
    full: now.toLocaleString('en-US', { timeZone: 'Asia/Yangon', hour12: true, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    iso: now.toISOString(),
    timestamp: now.getTime()
  };
}

// Config
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const BASE_URL = process.env.BASE_URL || `https://ath-digital-hub.onrender.com`;
const ADMIN_PATH = process.env.ADMIN_PATH || '/admin';

console.log(`\n🔐 ========== SYSTEM STARTUP ==========`);
console.log(`🌐 BASE_URL: ${BASE_URL}`);
console.log(`======================================\n`);

// Middleware
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Static folders
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
app.use(express.static(publicDir));

const uploadDir = path.join(__dirname, 'temp_uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/temp_uploads', express.static(uploadDir));

// Rate limiting
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
const strictLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10 });

// Packages
const PACKAGES = {
  "VIP 1": { price: 15000, data: "22GB", mins: "8000 Mins", sms: "5000 SMS" },
  "VIP 2": { price: 20000, data: "40GB", mins: "250 Mins", sms: "25 Any Net" },
  "VIP 3": { price: 25000, data: "40GB", mins: "1400 Mins", sms: "8000 SMS" },
  "VIP 4": { price: 30000, data: "120GB", mins: "Priority", sms: "5G+ Ultra" }
};

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + '.jpg')
});
const upload = multer({ 
  storage, limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') ? cb(null, true) : cb(new Error('Only JPEG/PNG allowed'), false)
});

// Helper functions
function maskPhone(phone) {
  if (!phone) return phone;
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 7) return phone;
  return cleaned.slice(0, 4) + '*'.repeat(cleaned.length - 7) + cleaned.slice(-3);
}

async function sendTelegramMessage(chatId, text, keyboard = null) {
  if (!BOT_TOKEN || !chatId) return false;
  try {
    const body = { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true };
    if (keyboard) body.reply_markup = JSON.stringify(keyboard);
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    return (await res.json()).ok;
  } catch { return false; }
}

async function sendTelegramPhoto(chatId, buffer, caption, keyboard = null) {
  if (!BOT_TOKEN || !chatId) return false;
  try {
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('photo', buffer, { filename: 'screenshot.jpg' });
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');
    if (keyboard) formData.append('reply_markup', JSON.stringify(keyboard));
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, { method: 'POST', body: formData, headers: formData.getHeaders() });
    return (await res.json()).ok;
  } catch { return false; }
}

// ============= ADMIN AUTHENTICATION =============
// Admin login (SQLite)
app.post('/api/admin/login', strictLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Username and password required" });
  }
  
  const admin = await database.verifyAdmin(username, password);
  if (admin) {
    // Generate simple session token (in production, use JWT)
    const token = Buffer.from(`${admin.id}:${Date.now()}`).toString('base64');
    await database.setSetting(`admin_token_${admin.id}`, token);
    res.json({ 
      success: true, 
      token: token,
      admin: { id: admin.id, username: admin.username, email: admin.email, full_name: admin.full_name, role: admin.role }
    });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

// Verify admin token middleware
async function verifyAdminToken(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token) return res.status(401).json({ success: false, message: "No token provided" });
  
  // Decode token to get admin id
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const adminId = decoded.split(':')[0];
    const savedToken = await database.getSetting(`admin_token_${adminId}`);
    if (savedToken === token) {
      req.adminId = adminId;
      return next();
    }
  } catch (e) {}
  res.status(401).json({ success: false, message: "Invalid token" });
}

// ============= ADMIN API ROUTES =============
app.get('/api/admin/orders', verifyAdminToken, async (req, res) => {
  try {
    const orders = await database.getAllOrders();
    const stats = await database.getStats();
    res.json({ success: true, orders, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/admin/orders/recent', verifyAdminToken, async (req, res) => {
  try {
    const orders = await database.getRecentOrders(parseInt(req.query.limit) || 10);
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/admin/orders/status/:status', verifyAdminToken, async (req, res) => {
  try {
    const orders = await database.getOrdersByStatus(req.params.status);
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/update-order', verifyAdminToken, async (req, res) => {
  const { orderId, status, rejectReason } = req.body;
  try {
    const order = await database.getOrderById(parseInt(orderId));
    if (!order) return res.status(404).json({ success: false });

    if (status === 'approved' && !order.startDate) {
      const start = new Date(); 
      const end = new Date(); 
      end.setDate(end.getDate() + 30);
      await database.updateOrderStatus(parseInt(orderId), 'approved', start.toISOString(), end.toISOString(), 30);
    } else if (status === 'rejected') {
      await database.updateOrderStatus(parseInt(orderId), 'rejected');
    } else {
      await database.updateOrderStatus(parseInt(orderId), status);
    }
    res.json({ success: true });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
});

app.post('/api/admin/delete-order', verifyAdminToken, async (req, res) => {
  const { orderId } = req.body;
  try {
    const order = await database.getOrderById(parseInt(orderId));
    if (order && order.screenshotPath) {
      const fileName = path.basename(order.screenshotPath);
      const fullPath = path.join(__dirname, 'temp_uploads', fileName);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
    await database.deleteOrder(parseInt(orderId));
    res.json({ success: true });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
});

// Admin management routes
app.get('/api/admin/admins', verifyAdminToken, async (req, res) => {
  try {
    const admins = await database.getAllAdmins();
    res.json({ success: true, admins });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/create-admin', verifyAdminToken, async (req, res) => {
  const { username, password, email, fullName, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Username and password required" });
  }
  const result = await database.createAdmin(username, password, email, fullName, role || 'admin');
  if (result.success) {
    res.json({ success: true });
  } else {
    res.status(500).json({ success: false, message: result.error });
  }
});

app.post('/api/admin/change-password', verifyAdminToken, async (req, res) => {
  const { adminId, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
  }
  await database.updateAdminPassword(parseInt(adminId), newPassword);
  res.json({ success: true });
});

// Search orders
app.get('/api/admin/search', verifyAdminToken, async (req, res) => {
  try {
    const orders = await database.searchOrders(req.query.q);
    res.json({ success: true, orders });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
});

// Get stats
app.get('/api/admin/stats', verifyAdminToken, async (req, res) => {
  try {
    const stats = await database.getStats();
    res.json({ success: true, stats });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
});

// ============= PUBLIC API ROUTES =============
// Create order (from frontend)
app.post('/api/order', [
  body('packageName').isIn(Object.keys(PACKAGES)),
  body('phone').matches(/^(09|\+959)[0-9]{7,9}$/)
], async (req, res) => {
  if (!validationResult(req).isEmpty()) return res.status(400).json({ success: false, message: "Invalid Input" });
  try {
    const { packageName, phone, note, userId, userEmail, userName } = req.body;
    const mt = getMyanmarTime12hr();
    const newOrder = { 
      packageName, 
      phone, 
      price: PACKAGES[packageName].price, 
      status: "pending_payment", 
      createdAt: mt.iso, 
      createdAtMyanmar: mt.full, 
      updatedAt: mt.iso, 
      note: note || '',
      userId: userId || '',
      userEmail: userEmail || '',
      userName: userName || ''
    };
    await database.createOrder(newOrder);
    
    if (ADMIN_CHAT_ID && BOT_TOKEN) {
      await sendTelegramMessage(ADMIN_CHAT_ID, `🆕 New Order\n📞 ${phone}\n📦 ${packageName}\n👤 ${userEmail || 'Guest'}`);
    }
    res.json({ success: true });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
});

// Submit payment with screenshot
app.post('/api/submit-payment', upload.single('screenshot'), async (req, res) => {
  try {
    const orderId = parseInt(req.body.orderId);
    if (!req.file) return res.status(400).json({ success: false, message: "Screenshot required" });
    
    const order = await database.getOrderById(orderId);
    if (!order) return res.status(404).json({ success: false });

    const screenshotPath = `/temp_uploads/${req.file.filename}`;
    await database.updateOrderScreenshot(orderId, screenshotPath);
    await database.updateOrderStatus(orderId, 'payment_received');
    if (req.body.note) await database.updateOrderNote(orderId, req.body.note);

    if (ADMIN_CHAT_ID && BOT_TOKEN) {
      const keyboard = { inline_keyboard: [[{ text: "✅ Approve", callback_data: `approve_${orderId}` }, { text: "❌ Reject", callback_data: `reject_${orderId}` }]] };
      await sendTelegramPhoto(ADMIN_CHAT_ID, fs.readFileSync(req.file.path), `💰 Payment Received #${order.id}\n📞 ${order.phone}\n📦 ${order.packageName}`, keyboard);
    }
    res.json({ success: true });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
});

// Track orders by phone
app.get('/api/track', async (req, res) => {
  try {
    const phone = req.query.phone;
    if (!phone) return res.json({ success: true, orders: [] });
    const orders = await database.getOrdersByPhone(phone);
    res.json({ success: true, orders });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
});

// Get user's own orders (by userId from Firebase)
app.get('/api/my-orders', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.json({ success: true, orders: [] });
    const orders = await database.getOrdersByUserId(userId);
    res.json({ success: true, orders });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
});

// ============= FRONTEND ROUTES =============
app.get(ADMIN_PATH, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/temp_uploads/')) return;
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============= START SERVER =============
const PORT = parseInt(process.env.PORT) || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Frontend: ${BASE_URL}`);
  console.log(`🔧 Admin Panel: ${BASE_URL}${ADMIN_PATH}`);
  console.log(`👤 Admin Login: username 'admin', password 'admin123'`);
  console.log(`✅ Server is ready!`);
  database.startExpiryChecker(60);
});

module.exports = app;
