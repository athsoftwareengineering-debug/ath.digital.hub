require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');
const fetch = require('node-fetch');

const database = require('./database');

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
console.log(`👥 GROUP_CHAT_ID: ${GROUP_CHAT_ID ? '✅' : '⚠️'}`);
console.log(`🌐 BASE_URL: ${BASE_URL}`);
console.log(`======================================\n`);

// ========== MIDDLEWARE ==========
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/temp_uploads', express.static(path.join(__dirname, 'temp_uploads')));

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
    const uploadDir = path.join(__dirname, 'temp_uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + '.jpg');
  }
});
const upload = multer({ storage: storage });

// ========== TELEGRAM FUNCTIONS ==========
async function sendTelegramMessage(chatId, text, keyboard = null) {
  if (!BOT_TOKEN || !chatId) return false;
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const body = { chat_id: chatId, text: text, parse_mode: 'Markdown' };
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
  if (!BOT_TOKEN) return false;
  try {
    const { FormData, Blob } = await import('formdata-node');
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('photo', new Blob([buffer], { type: 'image/jpeg' }), 'screenshot.jpg');
    formData.append('caption', caption);
    formData.append('parse_mode', 'Markdown');
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

// ========== COUNTDOWN FUNCTIONS ==========
function calculateRemainingDays(endDate) {
  if (!endDate) return null;
  const today = new Date();
  const end = new Date(endDate);
  const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
  return diffDays;
}

async function updateAllOrdersRemainingDays() {
  console.log('🔄 Daily countdown check...');
  const orders = database.getAllOrders();
  
  for (const order of orders) {
    if (order.status === 'approved' && order.endDate) {
      const remaining = calculateRemainingDays(order.endDate);
      database.db.prepare(`UPDATE orders SET daysRemaining = ? WHERE id = ?`).run(remaining, order.id);
      
      if (remaining <= 0 && !order.isExpired) {
        database.updateOrderStatus(order.id, 'expired');
        database.db.prepare(`UPDATE orders SET isExpired = 1 WHERE id = ?`).run(order.id);
        await sendTelegramMessage(ADMIN_CHAT_ID, `⏰ EXPIRED: Order #${order.id}\n📞 ${order.phone}`);
      }
      
      const alertDays = [5, 3, 1];
      if (alertDays.includes(remaining) && order.lastAlertDay !== remaining && remaining > 0) {
        database.updateOrderAlertDay(order.id, remaining);
        await sendTelegramMessage(ADMIN_CHAT_ID, `⚠️ REMINDER: Order #${order.id}\n📞 ${order.phone}\n⏳ ${remaining} days left!`);
      }
    }
  }
}

function scheduleDailyTask() {
  const now = new Date();
  const next9AM = new Date();
  next9AM.setHours(9, 0, 0, 0);
  if (now > next9AM) next9AM.setDate(next9AM.getDate() + 1);
  setTimeout(() => {
    updateAllOrdersRemainingDays();
    scheduleDailyTask();
  }, next9AM - now);
}
scheduleDailyTask();
setTimeout(() => updateAllOrdersRemainingDays(), 5000);

// ========== ADMIN AUTH ==========
function isAuthenticated(req, res, next) {
  const authToken = req.headers['x-admin-auth'];
  if (authToken === ADMIN_PASSWORD) return next();
  res.status(401).json({ success: false, message: "Unauthorized" });
}

app.use('/api/admin/*', (req, res, next) => {
  if (req.path === '/api/admin/login') return next();
  isAuthenticated(req, res, next);
});

// ========== API ENDPOINTS ==========

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, message: "Login successful" });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

// Create Order
app.post('/order', async (req, res) => {
  try {
    const { packageName, phone, note } = req.body;
    const mt = getMyanmarTime12hr();
    console.log(`📦 New order: ${packageName} for ${phone}`);
    
    const packageData = PACKAGES[packageName];
    if (!packageData) {
      return res.status(400).json({ success: false, message: "Invalid package" });
    }
    
    // Phone validation
    if (!phone || !/^(09|\+959)[0-9]{7,9}$/.test(phone)) {
      return res.status(400).json({ success: false, message: "Invalid phone number" });
    }
    
    const newOrder = {
      id: database.getNextOrderId(),
      packageName,
      phone,
      price: packageData.price,
      status: "pending_payment",
      createdAt: mt.iso,
      createdAtMyanmar: mt.full,
      updatedAt: mt.iso,
      note: note || ''
    };
    
    database.createOrder(newOrder);
    
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
    const mt = getMyanmarTime12hr();
    
    if (!screenshot) {
      return res.status(400).json({ success: false, message: "Screenshot required" });
    }
    
    const order = database.getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    
    tempFilePath = screenshot.path;
    const fileBuffer = fs.readFileSync(tempFilePath);
    
    // Update order
    const screenshotPath = `/temp_uploads/${screenshot.filename}`;
    database.updateOrderScreenshot(orderId, screenshotPath);
    database.updateOrderStatus(orderId, 'payment_received');
    if (note) {
      database.db.prepare(`UPDATE orders SET note = ?, updatedAt = ? WHERE id = ?`).run(note, mt.iso, orderId);
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
      fs.unlinkSync(tempFilePath);
    }
  }
});

// Track by Phone
app.get('/api/track-by-phone', (req, res) => {
  const { phone } = req.query;
  if (!phone || !/^(09|\+959)[0-9]{7,9}$/.test(phone)) {
    return res.status(400).json({ success: false, message: "Valid phone number required" });
  }
  const userOrders = database.getOrdersByPhone(phone);
  res.json({ success: true, orders: userOrders, count: userOrders.length });
});

// Admin Orders API
app.get('/api/admin/orders', (req, res) => {
  const authToken = req.headers['x-admin-auth'];
  if (authToken !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  
  const orders = database.getAllOrders();
  const stats = database.getStats();
  
  console.log(`📊 Admin API called: ${orders.length} orders found`);
  
  res.json({ success: true, orders: orders, stats: stats });
});

// Get Screenshot
app.get('/api/admin/order-screenshot', (req, res) => {
  const authToken = req.headers['x-admin-auth'];
  if (authToken !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const orderId = parseInt(req.query.orderId);
  const order = database.getOrderById(orderId);
  if (order && order.screenshotPath) {
    res.json({ success: true, screenshotUrl: `${BASE_URL}${order.screenshotPath}` });
  } else {
    res.json({ success: false, message: "No screenshot available" });
  }
});

// Update Order Status
app.post('/api/admin/update-order', async (req, res) => {
  const authToken = req.headers['x-admin-auth'];
  if (authToken !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  
  const { orderId, status } = req.body;
  const order = database.getOrderById(parseInt(orderId));
  
  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }
  
  const mt = getMyanmarTime12hr();
  
  if (status === 'approved' && !order.startDate) {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    const startDateStr = startDate.toISOString();
    const endDateStr = endDate.toISOString();
    
    database.updateOrderStatus(orderId, 'approved', startDateStr, endDateStr, 30);
    
    await sendTelegramMessage(ADMIN_CHAT_ID, `✅ Order #${orderId} approved! 30 days started.`);
    if (GROUP_CHAT_ID) {
      await sendTelegramMessage(GROUP_CHAT_ID, `🚨 DATA ACTIVATED 🚨\n📞 ${order.phone}\n📦 ${order.packageName}\n⏳ 30 days valid`);
    }
  } else {
    database.updateOrderStatus(orderId, status);
  }
  
  res.json({ success: true });
});

// ========== TELEGRAM WEBHOOK ==========
app.post(`/webhook/${BOT_TOKEN}`, async (req, res) => {
  try {
    console.log('📨 Webhook received');
    const { callback_query } = req.body;
    
    if (callback_query && callback_query.data) {
      const data = callback_query.data;
      const chatId = callback_query.message.chat.id;
      
      // Answer callback query
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callback_query.id })
      });
      
      if (data.startsWith('approve_')) {
        const orderId = parseInt(data.split('_')[1]);
        const order = database.getOrderById(orderId);
        
        if (order && !order.startDate) {
          const startDate = new Date();
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + 30);
          
          database.updateOrderStatus(orderId, 'approved', startDate.toISOString(), endDate.toISOString(), 30);
          
          await sendTelegramMessage(chatId, `✅ Order #${orderId} approved! 30 days started.`);
          if (GROUP_CHAT_ID) {
            await sendTelegramMessage(GROUP_CHAT_ID, `🚨 DATA ACTIVATED 🚨\n📞 ${order.phone}\n📦 ${order.packageName}`);
          }
        }
      }
      
      if (data.startsWith('reject_')) {
        const orderId = parseInt(data.split('_')[1]);
        database.updateOrderStatus(orderId, 'rejected');
        await sendTelegramMessage(chatId, `❌ Order #${orderId} rejected.`);
      }
    }
    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(200);
  }
});

// Test group endpoint
app.get('/test-group', async (req, res) => {
  if (!GROUP_CHAT_ID) {
    return res.json({ success: false, error: "GROUP_CHAT_ID not set" });
  }
  const result = await sendTelegramMessage(GROUP_CHAT_ID, `🧪 Test at ${getMyanmarTime12hr().full}`);
  res.json({ success: result, groupId: GROUP_CHAT_ID });
});

// ========== SERVE PAGES ==========
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
  const mt = getMyanmarTime12hr();
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📱 Customer: ${BASE_URL}/`);
  console.log(`👑 Admin: ${BASE_URL}/admin`);
  console.log(`🔑 Admin Password: ${ADMIN_PASSWORD}\n`);
  
  if (BOT_TOKEN) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${BASE_URL}/webhook/${BOT_TOKEN}`);
      const result = await response.json();
      console.log(`📡 Webhook: ${result.ok ? '✅' : '❌'} ${result.description || ''}\n`);
    } catch (err) {
      console.log(`📡 Webhook set failed: ${err.message}\n`);
    }
  }
});

module.exports = app;
