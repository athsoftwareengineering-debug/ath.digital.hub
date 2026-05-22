require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');

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
console.log(`👥 GROUP_CHAT_ID: ${GROUP_CHAT_ID ? '✅' : '❌'}`);
console.log(`🌐 BASE_URL: ${BASE_URL}`);
console.log(`======================================\n`);

// ========== MIDDLEWARE ==========
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Create temp_uploads directory
const uploadDir = path.join(__dirname, 'temp_uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/temp_uploads', express.static(uploadDir));

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
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + '.jpg');
  }
});
const upload = multer({ storage: storage });

// ========== TELEGRAM FUNCTIONS (using native fetch - Node 18+) ==========
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
  if (!BOT_TOKEN || !chatId) return false;
  try {
    // Use native fetch with FormData (Node 18+)
    const formData = new FormData();
    const blob = new Blob([buffer], { type: 'image/jpeg' });
    formData.append('chat_id', chatId);
    formData.append('photo', blob, 'screenshot.jpg');
    formData.append('caption', caption);
    formData.append('parse_mode', 'Markdown');
    if (keyboard) formData.append('reply_markup', JSON.stringify(keyboard));
    
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: formData
    });
    const result = await response.json();
    if (!result.ok) console.error('Telegram photo error:', result.description);
    return result.ok;
  } catch (error) { 
    console.error('Telegram photo error:', error);
    return false; 
  }
}

// ========== DAILY TASKS ==========
async function updateAllOrdersRemainingDays() {
  console.log('🔄 Daily countdown check...');
  
  // Update expired orders using database module
  const expiredResult = database.updateExpiredOrders();
  if (expiredResult.changes > 0) {
    console.log(`✅ Expired ${expiredResult.changes} orders`);
  }
  
  const orders = database.getAllOrders();
  for (const order of orders) {
    if (order.status === 'approved' && order.endDate) {
      const remaining = Math.ceil((new Date(order.endDate) - new Date()) / (1000 * 60 * 60 * 24));
      // Update daysRemaining directly
      database.db.prepare(`UPDATE orders SET daysRemaining = ? WHERE id = ?`).run(remaining, order.id);
      
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
  const delay = next9AM - now;
  console.log(`⏰ Next daily task at: ${next9AM.toLocaleString()}`);
  setTimeout(() => {
    updateAllOrdersRemainingDays();
    scheduleDailyTask();
  }, delay);
}
scheduleDailyTask();
// Run once on startup after 5 seconds
setTimeout(() => updateAllOrdersRemainingDays(), 5000);

// ========== ADMIN AUTH MIDDLEWARE ==========
function isAuthenticated(req, res, next) {
  const authToken = req.headers['x-admin-auth'];
  if (authToken === ADMIN_PASSWORD) return next();
  res.status(401).json({ success: false, message: "Unauthorized" });
}

// ========== TELEGRAM WEBHOOK ==========
// Callback query handler for inline buttons
app.post(`/webhook/${BOT_TOKEN}`, async (req, res) => {
  try {
    const update = req.body;
    
    if (update.callback_query) {
      const callbackData = update.callback_query.data;
      const message = update.callback_query.message;
      const chatId = message.chat.id;
      
      if (callbackData.startsWith('approve_')) {
        const orderId = parseInt(callbackData.split('_')[1]);
        const order = database.getOrderById(orderId);
        
        if (order && order.status === 'payment_received') {
          const startDate = new Date();
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + 30);
          
          database.updateOrderStatus(orderId, 'approved', startDate.toISOString(), endDate.toISOString(), 30);
          
          await sendTelegramMessage(chatId, `✅ Order #${orderId} approved! 30 days started.`);
          if (GROUP_CHAT_ID) {
            await sendTelegramMessage(GROUP_CHAT_ID, `🚨 DATA ACTIVATED 🚨\n📞 ${order.phone}\n📦 ${order.packageName}\n⏳ 30 days valid`);
          }
        } else {
          await sendTelegramMessage(chatId, `⚠️ Order #${orderId} cannot be approved (status: ${order?.status})`);
        }
      } else if (callbackData.startsWith('reject_')) {
        const orderId = parseInt(callbackData.split('_')[1]);
        database.updateOrderStatus(orderId, 'rejected');
        await sendTelegramMessage(chatId, `❌ Order #${orderId} rejected.`);
      }
      
      // Answer callback query
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: update.callback_query.id })
      });
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(200);
  }
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

// Get all orders (Admin)
app.get('/api/admin/orders', isAuthenticated, (req, res) => {
  try {
    const orders = database.getAllOrders();
    const stats = database.getStats();
    console.log(`📊 Admin API called: ${orders.length} orders found`);
    res.json({ success: true, orders: orders, stats: stats });
  } catch (error) {
    console.error('Admin orders error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get order screenshot (Admin)
app.get('/api/admin/order-screenshot', isAuthenticated, (req, res) => {
  const orderId = parseInt(req.query.orderId);
  const order = database.getOrderById(orderId);
  if (order && order.screenshotPath) {
    // Ensure screenshotPath starts with /temp_uploads/
    const screenshotUrl = order.screenshotPath.startsWith('/') 
      ? `${BASE_URL}${order.screenshotPath}`
      : `${BASE_URL}/${order.screenshotPath}`;
    res.json({ success: true, screenshotUrl: screenshotUrl });
  } else {
    res.json({ success: false, message: "No screenshot available" });
  }
});

// Update order status (Admin)
app.post('/api/admin/update-order', isAuthenticated, async (req, res) => {
  const { orderId, status } = req.body;
  const order = database.getOrderById(parseInt(orderId));
  
  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }
  
  if (status === 'approved' && !order.startDate) {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    
    database.updateOrderStatus(parseInt(orderId), 'approved', startDate.toISOString(), endDate.toISOString(), 30);
    
    await sendTelegramMessage(ADMIN_CHAT_ID, `✅ Order #${orderId} approved! 30 days started.`);
    if (GROUP_CHAT_ID) {
      await sendTelegramMessage(GROUP_CHAT_ID, `🚨 DATA ACTIVATED 🚨\n📞 ${order.phone}\n📦 ${order.packageName}\n⏳ 30 days valid`);
    }
  } else {
    database.updateOrderStatus(parseInt(orderId), status);
  }
  
  res.json({ success: true });
});

// Update order note (Admin)
app.post('/api/admin/update-note', isAuthenticated, (req, res) => {
  const { orderId, note } = req.body;
  database.updateOrderNote(parseInt(orderId), note);
  res.json({ success: true });
});

// Create Order (Customer)
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
    
    await sendTelegramMessage(ADMIN_CHAT_ID, `🆕 New Order #${newOrder.id}\n📦 ${packageName}\n📞 ${phone}\n💰 ${packageData.price.toLocaleString()} KS\n✏️ Note: ${note || 'None'}`);
    res.json({ success: true, orderId: newOrder.id });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Submit Payment (Customer)
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
      database.updateOrderNote(orderId, note);
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

// Track by Phone (Customer)
app.get('/api/track-by-phone', (req, res) => {
  const { phone } = req.query;
  if (!phone || !/^(09|\+959)[0-9]{7,9}$/.test(phone)) {
    return res.status(400).json({ success: false, message: "Valid phone number required" });
  }
  const userOrders = database.getOrdersByPhone(phone);
  res.json({ success: true, orders: userOrders, count: userOrders.length });
});

// Test group endpoint
app.get('/test-group', async (req, res) => {
  if (!GROUP_CHAT_ID) {
    return res.json({ success: false, error: "GROUP_CHAT_ID not set" });
  }
  const result = await sendTelegramMessage(GROUP_CHAT_ID, `🧪 Test at ${getMyanmarTime12hr().full}`);
  res.json({ success: result, groupId: GROUP_CHAT_ID });
});

// Search orders (Admin)
app.get('/api/admin/search', isAuthenticated, (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.json({ success: true, orders: database.getAllOrders() });
  }
  const results = database.searchOrders(q);
  res.json({ success: true, orders: results });
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
      const webhookUrl = `${BASE_URL}/webhook/${BOT_TOKEN}`;
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
      const result = await response.json();
      console.log(`📡 Webhook URL: ${webhookUrl}`);
      console.log(`📡 Webhook set: ${result.ok ? '✅' : '❌'} ${result.description || ''}\n`);
    } catch (err) {
      console.log(`📡 Webhook set failed: ${err.message}\n`);
    }
  }
  
  // Start expiry checker from database module
  database.startExpiryChecker(60);
});

module.exports = app;
