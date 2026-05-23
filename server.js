require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');

// Check if database module exists
let database;
try {
  database = require('./database');
  console.log('✅ Database module loaded successfully');
} catch (err) {
  console.error('❌ Failed to load database module:', err.message);
  process.exit(1);
}

const app = express();

// ========== TIME ZONE ==========
process.env.TZ = 'Asia/Yangon';

function getMyanmarTime12hr() {
  const now = new Date();
  return {
    full: now.toLocaleString('en-US', { 
      timeZone: 'Asia/Yangon',
      hour12: true,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }),
    iso: now.toISOString(),
    timestamp: now.getTime()
  };
}

// ========== ENVIRONMENT VARIABLES ==========
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "mytel2024";
const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 10000}`;

console.log(`\n🔐 ========== SYSTEM STARTUP ==========`);
console.log(`🔑 Admin Password: ${ADMIN_PASSWORD}`);
console.log(`🕐 Time: ${getMyanmarTime12hr().full}`);
console.log(`📨 BOT_TOKEN: ${BOT_TOKEN ? '✅' : '❌'}`);
console.log(`👤 ADMIN_CHAT_ID: ${ADMIN_CHAT_ID ? '✅' : '❌'}`);
console.log(`👥 GROUP_CHAT_ID: ${GROUP_CHAT_ID ? '✅' : '❌'}`);
console.log(`🌐 BASE_URL: ${BASE_URL}`);
console.log(`======================================\n`);

// ========== MIDDLEWARE ==========
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ========== STATIC FILES ==========
// Public folder for HTML files
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  console.log('⚠️ public folder not found, creating...');
  fs.mkdirSync(publicDir, { recursive: true });
}
app.use(express.static(publicDir));

// Temp uploads folder for screenshots
const uploadDir = path.join(__dirname, 'temp_uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/temp_uploads', express.static(uploadDir));

console.log(`📁 Upload folder: ${uploadDir}`);
console.log(`📁 Public folder: ${publicDir}`);

// ========== PACKAGES ==========
const PACKAGES = {
  "VIP LEVEL - 1": { price: 15000, desc: "22GB / 8000 Mins / 5000 SMS" },
  "VIP LEVEL - 2": { price: 20000, desc: "40GB / 250 Mins / 25 Any Net" },
  "VIP LEVEL - 3": { price: 25000, desc: "40GB / 1400 Mins / 8000 SMS" },
  "VIP LEVEL - 4": { price: 30000, desc: "120GB High-Speed Data" }
};

// ========== FILE UPLOAD ==========
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + '.jpg';
    cb(null, uniqueName);
  }
});
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// ========== TELEGRAM FUNCTIONS ==========
async function sendTelegramMessage(chatId, text, keyboard = null) {
  if (!BOT_TOKEN || !chatId) return false;
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const body = { 
      chat_id: chatId, 
      text: text, 
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };
    if (keyboard) body.reply_markup = JSON.stringify(keyboard);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await response.json();
    return result.ok;
  } catch (error) { 
    console.error('Telegram send error:', error);
    return false; 
  }
}

async function sendTelegramPhoto(chatId, buffer, caption, keyboard = null) {
  if (!BOT_TOKEN || !chatId) return false;
  try {
    const formData = new FormData();
    const blob = new Blob([buffer], { type: 'image/jpeg' });
    formData.append('chat_id', chatId);
    formData.append('photo', blob, 'screenshot.jpg');
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');
    if (keyboard) formData.append('reply_markup', JSON.stringify(keyboard));
    
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: formData
    });
    const result = await response.json();
    return result.ok;
  } catch (error) { 
    console.error('Telegram photo error:', error);
    return false; 
  }
}

// ========== ADMIN AUTH ==========
function isAuthenticated(req, res, next) {
  const authToken = req.headers['x-admin-auth'];
  if (authToken === ADMIN_PASSWORD) return next();
  res.status(401).json({ success: false, message: "Unauthorized" });
}

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, message: "Login successful" });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

// Get all orders
app.get('/api/admin/orders', isAuthenticated, async (req, res) => {
  try {
    const orders = await database.getAllOrders();
    const stats = await database.getStats();
    res.json({ success: true, orders: orders, stats: stats });
  } catch (error) {
    console.error('Admin orders error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get order screenshot
app.get('/api/admin/order-screenshot', isAuthenticated, async (req, res) => {
  const orderId = parseInt(req.query.orderId);
  try {
    const order = await database.getOrderById(orderId);
    if (order && order.screenshotPath) {
      let screenshotUrl;
      if (order.screenshotPath.startsWith('http')) {
        screenshotUrl = order.screenshotPath;
      } else if (order.screenshotPath.startsWith('/')) {
        screenshotUrl = `${BASE_URL}${order.screenshotPath}`;
      } else {
        screenshotUrl = `${BASE_URL}/${order.screenshotPath}`;
      }
      res.json({ success: true, screenshotUrl: screenshotUrl });
    } else {
      res.json({ success: false, message: "No screenshot available" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update order status
app.post('/api/admin/update-order', isAuthenticated, async (req, res) => {
  const { orderId, status } = req.body;
  try {
    const order = await database.getOrderById(parseInt(orderId));
    
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    
    if (status === 'approved' && !order.startDate) {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
      
      await database.updateOrderStatus(parseInt(orderId), 'approved', startDate.toISOString(), endDate.toISOString(), 30);
      await sendTelegramMessage(ADMIN_CHAT_ID, `✅ Order #${orderId} approved! 30 days started.`);
    } else {
      await database.updateOrderStatus(parseInt(orderId), status);
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create Order
app.post('/order', async (req, res) => {
  try {
    const { packageName, phone, note } = req.body;
    const mt = getMyanmarTime12hr();
    
    const packageData = PACKAGES[packageName];
    if (!packageData) {
      return res.status(400).json({ success: false, message: "Invalid package" });
    }
    
    if (!phone || !/^(09|\+959)[0-9]{7,9}$/.test(phone)) {
      return res.status(400).json({ success: false, message: "Invalid phone number" });
    }
    
    const newOrder = {
      id: await database.getNextOrderId(),
      packageName,
      phone,
      price: packageData.price,
      status: "pending_payment",
      createdAt: mt.iso,
      createdAtMyanmar: mt.full,
      updatedAt: mt.iso,
      note: note || ''
    };
    
    await database.createOrder(newOrder);
    await sendTelegramMessage(ADMIN_CHAT_ID, `🆕 New Order #${newOrder.id}\n📦 ${packageName}\n📞 ${phone}\n💰 ${packageData.price.toLocaleString()} KS`);
    
    res.json({ success: true, orderId: newOrder.id });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Submit Payment
app.post('/submit-payment', upload.single('screenshot'), async (req, res) => {
  let tempFilePath = null;
  try {
    const orderId = parseInt(req.body.orderId);
    const screenshot = req.file;
    const note = req.body.note || '';
    
    if (!screenshot) {
      return res.status(400).json({ success: false, message: "Screenshot required" });
    }
    
    const order = await database.getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    
    tempFilePath = screenshot.path;
    const fileBuffer = fs.readFileSync(tempFilePath);
    
    const screenshotPath = `/temp_uploads/${screenshot.filename}`;
    await database.updateOrderScreenshot(orderId, screenshotPath);
    await database.updateOrderStatus(orderId, 'payment_received');
    if (note) {
      await database.updateOrderNote(orderId, note);
    }
    
    const caption = `💰 Payment Received #${orderId}\n📦 ${order.packageName}\n📞 ${order.phone}\n💰 ${order.price.toLocaleString()} KS`;
    const keyboard = {
      inline_keyboard: [[
        { text: "✅ Approve (30 Days)", callback_data: `approve_${orderId}` },
        { text: "❌ Reject", callback_data: `reject_${orderId}` }
      ]]
    };
    await sendTelegramPhoto(ADMIN_CHAT_ID, fileBuffer, caption, keyboard);
    
    res.json({ success: true, message: "Payment submitted!" });
  } catch (error) {
    console.error('Submit payment error:', error);
    res.status(500).json({ success: false, message: "Server error" });
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch(e) {}
    }
  }
});

// Track by Phone
app.get('/api/track-by-phone', async (req, res) => {
  const { phone } = req.query;
  if (!phone || !/^(09|\+959)[0-9]{7,9}$/.test(phone)) {
    return res.status(400).json({ success: false, message: "Valid phone number required" });
  }
  const userOrders = await database.getOrdersByPhone(phone);
  res.json({ success: true, orders: userOrders, count: userOrders.length });
});

// Search orders
app.get('/api/admin/search', isAuthenticated, async (req, res) => {
  const { q } = req.query;
  if (!q) {
    const orders = await database.getAllOrders();
    return res.json({ success: true, orders: orders });
  }
  const results = await database.searchOrders(q);
  res.json({ success: true, orders: results });
});

// ========== SERVE PAGES ==========
app.get('/admin', (req, res) => {
  const adminPath = path.join(__dirname, 'public', 'admin.html');
  if (fs.existsSync(adminPath)) {
    res.sendFile(adminPath);
  } else {
    res.status(404).send('Admin page not found. Make sure public/admin.html exists.');
  }
});

app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Index page not found. Make sure public/index.html exists.');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 10000;

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📱 Customer: ${BASE_URL}/`);
  console.log(`👑 Admin: ${BASE_URL}/admin`);
  console.log(`🔑 Admin Password: ${ADMIN_PASSWORD}`);
  console.log(`✅ Health check: ${BASE_URL}/health\n`);
  
  database.startExpiryChecker(60);
});

module.exports = app;
