const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();

// ========== MIDDLEWARE ==========
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ========== ENVIRONMENT VARIABLES ==========
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.CHAT_ID;
const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "mytel2024";

// ========== DATA STORAGE ==========
let orders = [];
let orderIdCounter = 1;

const PACKAGES = {
  "VIP LEVEL - 1": { price: 15000, desc: "22GB / 8000 Mins / 5000 SMS" },
  "VIP LEVEL - 2": { price: 20000, desc: "40GB / 250 Mins / 25 Any Net" },
  "VIP LEVEL - 3": { price: 25000, desc: "40GB / 1400 Mins / 8000 SMS" },
  "VIP LEVEL - 4 (ULTRA)": { price: 30000, desc: "120GB High-Speed Data" }
};

// ========== FILE UPLOAD SETUP ==========
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
    console.log(`📨 Telegram: ${result.ok ? '✅' : '❌'} ${result.description || ''}`);
    return result.ok;
  } catch (error) {
    console.error("Telegram error:", error);
    return false;
  }
}

async function sendTelegramPhoto(chatId, buffer, caption, keyboard = null) {
  if (!BOT_TOKEN) return false;
  try {
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
    console.error("Photo error:", error);
    return false;
  }
}

// ========== COUNTDOWN FUNCTIONS ==========
function calculateRemainingDays(endDate) {
  const today = new Date();
  const end = new Date(endDate);
  const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
  return diffDays;
}

function updateAllOrdersRemainingDays() {
  console.log('🔄 Running daily countdown check...');
  orders.forEach(order => {
    if (order.status === 'approved' && order.endDate) {
      const remaining = calculateRemainingDays(order.endDate);
      order.daysRemaining = remaining;
      
      if (remaining <= 0 && !order.isExpired) {
        order.isExpired = true;
        order.status = 'expired';
        sendTelegramMessage(ADMIN_CHAT_ID, `⏰ *EXPIRED* Order #${order.id}\n📞 ${order.phone}`);
      }
      
      const alertDays = [5, 3, 1];
      if (alertDays.includes(remaining) && order.lastAlertDay !== remaining && remaining > 0) {
        order.lastAlertDay = remaining;
        sendTelegramMessage(ADMIN_CHAT_ID, `⚠️ *REMINDER* Order #${order.id}\n📞 ${order.phone}\n⏳ ${remaining} days remaining!`);
        if (GROUP_CHAT_ID) {
          sendTelegramMessage(GROUP_CHAT_ID, `🔔 *Data Expiring Soon*\n📞 ${order.phone}\n⏳ ${remaining} days left!`);
        }
      }
    }
  });
}

// Daily scheduler at 9 AM
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

// ========== ADMIN AUTHENTICATION ==========
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
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    res.json({ success: true, message: "Login successful" });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

// Create Order
app.post('/order', async (req, res) => {
  try {
    const { packageName, phone } = req.body;
    if (!packageName || !phone) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }
    
    const packageData = PACKAGES[packageName];
    if (!packageData) {
      return res.status(400).json({ success: false, message: "Invalid package" });
    }
    
    const newOrder = {
      id: orderIdCounter++,
      packageName, phone,
      price: packageData.price,
      status: "pending_payment",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      startDate: null, endDate: null,
      daysRemaining: null, isExpired: false, lastAlertDay: null
    };
    orders.unshift(newOrder);
    
    await sendTelegramMessage(ADMIN_CHAT_ID,
      `🆕 *New Order* #${newOrder.id}\n━━━━━━━━━━━━━━━━━━━━\n📦 ${packageName}\n📞 ${phone}\n💰 ${packageData.price.toLocaleString()} KS`
    );
    
    res.json({ success: true, orderId: newOrder.id, packageName, price: packageData.price, phone });
  } catch (error) {
    console.error("Order error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Submit Payment with Screenshot
app.post('/submit-payment', upload.single('screenshot'), async (req, res) => {
  let tempFilePath = null;
  try {
    const orderId = parseInt(req.body.orderId);
    const screenshot = req.file;
    
    if (!screenshot) return res.status(400).json({ success: false, message: "Screenshot required" });
    
    const order = orders.find(o => o.id === orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    
    order.status = 'payment_received';
    tempFilePath = screenshot.path;
    const fileBuffer = fs.readFileSync(tempFilePath);
    
    const caption = `💰 *Payment Received* #${orderId}\n━━━━━━━━━━━━━━━━━━━━\n📦 ${order.packageName}\n📞 ${order.phone}\n💰 ${order.price.toLocaleString()} KS`;
    const keyboard = {
      inline_keyboard: [
        [{ text: "✅ Approve (Start 30 Days)", callback_data: `approve_${orderId}` }],
        [{ text: "❌ Reject", callback_data: `reject_${orderId}` }]
      ]
    };
    
    await sendTelegramPhoto(ADMIN_CHAT_ID, fileBuffer, caption, keyboard);
    res.json({ success: true, message: "Payment submitted!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
  }
});

// Track Order
app.get('/api/track-order', (req, res) => {
  const { orderId, phone } = req.query;
  const order = orders.find(o => o.id === parseInt(orderId) && o.phone === phone);
  if (!order) return res.json({ success: false, message: "Order not found" });
  
  let countdownInfo = null;
  if (order.startDate && order.endDate) {
    const remaining = calculateRemainingDays(order.endDate);
    countdownInfo = {
      startDate: order.startDate, endDate: order.endDate,
      daysRemaining: remaining > 0 ? remaining : 0,
      isExpired: remaining <= 0,
      progressPercent: Math.max(0, (remaining / 30) * 100)
    };
  }
  res.json({ success: true, order: { ...order, countdown: countdownInfo } });
});

// Admin APIs
app.get('/api/admin/orders', (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  let filtered = [...orders];
  if (status && status !== 'all') filtered = filtered.filter(o => o.status === status);
  filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const start = (parseInt(page) - 1) * parseInt(limit);
  const paginated = filtered.slice(start, start + parseInt(limit));
  
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending_payment').length,
    paid: orders.filter(o => o.status === 'payment_received').length,
    approved: orders.filter(o => o.status === 'approved').length,
    rejected: orders.filter(o => o.status === 'rejected').length,
    expired: orders.filter(o => o.status === 'expired').length,
    revenue: orders.filter(o => o.status === 'approved').reduce((sum, o) => sum + o.price, 0)
  };
  res.json({ success: true, orders: paginated, total: filtered.length, stats });
});

app.post('/api/admin/update-order', async (req, res) => {
  const { orderId, status } = req.body;
  const order = orders.find(o => o.id === parseInt(orderId));
  if (!order) return res.status(404).json({ success: false });
  
  if (status === 'approved' && !order.startDate) {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    order.startDate = startDate.toISOString();
    order.endDate = endDate.toISOString();
    order.daysRemaining = 30;
    order.status = 'approved';
    
    await sendTelegramMessage(ADMIN_CHAT_ID, `✅ Order #${orderId} approved! 30 days started.`);
    if (GROUP_CHAT_ID) {
      await sendTelegramMessage(GROUP_CHAT_ID, `🚨 *DATA ACTIVATED* 🚨\n📞 ${order.phone}\n📦 ${order.packageName}\n⏳ 30 days valid`);
    }
  } else {
    order.status = status;
  }
  res.json({ success: true, order });
});

// ========== TELEGRAM WEBHOOK ==========
app.post(`/webhook/${BOT_TOKEN}`, async (req, res) => {
  try {
    const { callback_query } = req.body;
    if (callback_query?.data) {
      const data = callback_query.data;
      const chatId = callback_query.message.chat.id;
      
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callback_query.id })
      });
      
      if (data.startsWith('approve_')) {
        const orderId = parseInt(data.split('_')[1]);
        const order = orders.find(o => o.id === orderId);
        if (order && !order.startDate) {
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + 30);
          order.startDate = new Date().toISOString();
          order.endDate = endDate.toISOString();
          order.daysRemaining = 30;
          order.status = 'approved';
          await sendTelegramMessage(chatId, `✅ Order #${orderId} approved!`);
          if (GROUP_CHAT_ID) {
            await sendTelegramMessage(GROUP_CHAT_ID, `🚨 *DATA ACTIVATED* 🚨\n📞 ${order.phone}\n📦 ${order.packageName}`);
          }
        }
      }
      if (data.startsWith('reject_')) {
        const orderId = parseInt(data.split('_')[1]);
        const order = orders.find(o => o.id === orderId);
        if (order) {
          order.status = 'rejected';
          await sendTelegramMessage(chatId, `❌ Order #${orderId} rejected.`);
        }
      }
    }
    res.sendStatus(200);
  } catch (error) {
    res.sendStatus(200);
  }
});

// ========== SERVE PAGES ==========
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin-login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin-login.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// ========== START SERVER ==========
const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`=================================`);
  console.log(`📨 BOT_TOKEN: ${BOT_TOKEN ? '✅' : '❌'}`);
  console.log(`👤 ADMIN_CHAT_ID: ${ADMIN_CHAT_ID ? '✅' : '❌'}`);
  console.log(`👥 GROUP_CHAT_ID: ${GROUP_CHAT_ID ? '✅' : '⚠️'}`);
  console.log(`🔐 ADMIN_USERNAME: ${ADMIN_USERNAME}`);
  console.log(`=================================`);
  console.log(`📱 Customer: https://ath-digital-hub.onrender.com/`);
  console.log(`🔑 Admin Login: https://ath-digital-hub.onrender.com/admin-login`);
  console.log(`👑 Admin Dashboard: https://ath-digital-hub.onrender.com/admin\n`);
  
  if (BOT_TOKEN) {
    const webhookUrl = `https://ath-digital-hub.onrender.com/webhook/${BOT_TOKEN}`;
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
    const result = await response.json();
    console.log(`📡 Webhook: ${result.ok ? '✅' : '❌'} ${result.description || ''}\n`);
  }
});
