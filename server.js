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

// ========== STATIC FILES ==========
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
app.use(express.static(publicDir));

const uploadDir = path.join(__dirname, 'temp_uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/temp_uploads', express.static(uploadDir));

console.log(`📁 Public folder: ${publicDir}`);
console.log(`📁 Upload folder: ${uploadDir}`);

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

// ========== HELPER: MASK PHONE NUMBER FOR GROUP ==========
function maskPhone(phone) {
  if (!phone) return phone;
  // Remove any spaces or non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 7) return phone; // too short, return as is
  // Show first 4 digits and last 3 digits, mask the rest with *
  const first4 = cleaned.slice(0, 4);
  const last3 = cleaned.slice(-3);
  const middleLength = cleaned.length - 4 - 3;
  const masked = first4 + '*'.repeat(middleLength) + last3;
  return masked;
}

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
    console.error('Telegram send error:', error.message);
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
    console.error('Telegram photo error:', error.message);
    return false; 
  }
}

// ========== GROUP MESSAGES (WITH MASKED PHONE) ==========
// Note: These functions are for GROUP only. Admin messages keep full phone number.
async function sendToGroupOrderApproved(order) {
  if (!GROUP_CHAT_ID) return false;
  const startDate = new Date(order.startDate);
  const endDate = new Date(order.endDate);
  
  const startDateStr = startDate.toLocaleString('en-US', {
    timeZone: 'Asia/Yangon',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const endDateStr = endDate.toLocaleString('en-US', {
    timeZone: 'Asia/Yangon',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  
  const maskedPhone = maskPhone(order.phone);
  
  const message = `✅ <b>အော်ဒါအတည်ပြုပြီးပါပြီ။</b> ✅
━━━━━━━━━━━━━━━━━━━━
🆔 အော်ဒါအမှတ်: <b>#${order.id}</b>
📞 ဖုန်းနံပါတ်: <code>${maskedPhone}</code>
📦 Package: <b>${order.packageName}</b>
💰 ပမာဏ: <b>${order.price.toLocaleString()} KS</b>
📅 စတင်ရက်: ${startDateStr}
⏰ ကုန်ဆုံးရက်: ${endDateStr}
━━━━━━━━━━━━━━━━━━━━
✅ Status: <b>✅ ဒေတာသွင်းပြီးပါပြီ။ ကျေးဇူးပြု၍ သုံးစွဲပါ။</b>
👤 အတည်ပြုသူ: 𝐀𝐃𝐌𝐈𝐍 𝐒𝐔𝐏𝐏𝐎𝐑𝐓 | 𝟐𝟒/𝟕`;
  return await sendTelegramMessage(GROUP_CHAT_ID, message);
}

async function sendToGroupOrderRejected(order, reason = "ငွေလွှဲ မှန်ကန်မှုမရှိပါ။") {
  if (!GROUP_CHAT_ID) return false;
  const maskedPhone = maskPhone(order.phone);
  const message = `❌ <b>အော်ဒါပယ်ဖျက်ခြင်း</b> ❌
━━━━━━━━━━━━━━━━━━━━
🆔 အော်ဒါအမှတ်: <b>#${order.id}</b>
📞 ဖုန်းနံပါတ်: <code>${maskedPhone}</code>
📦 Package: <b>${order.packageName}</b>
💰 ပမာဏ: <b>${order.price.toLocaleString()} KS</b>
📝 အကြောင်းရင်း: ${reason}
━━━━━━━━━━━━━━━━━━━━
❌ Status: <b>❌ ပယ်ဖျက်ထားပါသည်။</b>
⚠️ ကျေးဇူးပြု၍ ပြန်လည်စစ်ဆေးပါ။
👤 အတည်ပြုသူ: 𝐀𝐃𝐌𝐈𝐍 𝐒𝐔𝐏𝐏𝐎𝐑𝐓 | 𝟐𝟒/𝟕`;
  return await sendTelegramMessage(GROUP_CHAT_ID, message);
}

// (Note: sendToGroupNewOrder and sendToGroupPaymentReceived are not used as per previous request, but we keep them commented)
// async function sendToGroupNewOrder(order) { ... }
// async function sendToGroupPaymentReceived(order, screenshotBuffer) { ... }

// ========== TELEGRAM WEBHOOK ==========
app.post(`/webhook/${BOT_TOKEN}`, async (req, res) => {
  try {
    const update = req.body;
    
    if (update && update.callback_query) {
      const callbackData = update.callback_query.data;
      const chatId = update.callback_query.message.chat.id;
      
      if (callbackData.startsWith('approve_')) {
        const orderId = parseInt(callbackData.split('_')[1]);
        const order = await database.getOrderById(orderId);
        
        if (order && order.status === 'payment_received') {
          const startDate = new Date();
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + 30);
          
          await database.updateOrderStatus(orderId, 'approved', startDate.toISOString(), endDate.toISOString(), 30);
          await sendTelegramMessage(chatId, `✅ Order #${orderId} approved! 30 days started.`);
          // Send to GROUP with masked phone
          await sendToGroupOrderApproved(order);
        }
      } else if (callbackData.startsWith('reject_')) {
        const orderId = parseInt(callbackData.split('_')[1]);
        const order = await database.getOrderById(orderId);
        
        if (order) {
          await database.updateOrderStatus(orderId, 'rejected');
          await sendTelegramMessage(chatId, `❌ Order #${orderId} rejected.`);
          await sendToGroupOrderRejected(order);
        }
      }
      
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
      let screenshotUrl = order.screenshotPath.startsWith('/') 
        ? `${BASE_URL}${order.screenshotPath}`
        : `${BASE_URL}/${order.screenshotPath}`;
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
  const { orderId, status, rejectReason } = req.body;
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
      await sendToGroupOrderApproved(order);
    } else if (status === 'rejected') {
      await database.updateOrderStatus(parseInt(orderId), 'rejected');
      await sendTelegramMessage(ADMIN_CHAT_ID, `❌ Order #${orderId} rejected.`);
      await sendToGroupOrderRejected(order, rejectReason);
    } else {
      await database.updateOrderStatus(parseInt(orderId), status);
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Update order error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ========== DELETE ORDER ==========
app.post('/api/admin/delete-order', isAuthenticated, async (req, res) => {
  const { orderId } = req.body;

  if (!orderId || isNaN(parseInt(orderId))) {
    return res.status(400).json({ success: false, message: "Invalid order ID" });
  }

  try {
    const order = await database.getOrderById(parseInt(orderId));
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.screenshotPath) {
      const fullPath = path.join(__dirname, order.screenshotPath);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
          console.log(`🗑️ Deleted screenshot: ${fullPath}`);
        } catch (err) {
          console.error(`Failed to delete screenshot: ${err.message}`);
        }
      }
    }

    const result = await database.deleteOrder(parseInt(orderId));
    if (!result || result.changes === 0) {
      return res.status(500).json({ success: false, message: "Failed to delete order" });
    }

    await sendTelegramMessage(ADMIN_CHAT_ID, `🗑️ Order #${orderId} permanently deleted by admin.`);
    res.json({ success: true, message: `Order #${orderId} deleted` });
  } catch (error) {
    console.error("Delete order error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create Order (only admin receives, no group)
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
    // Admin gets full phone number
    await sendTelegramMessage(ADMIN_CHAT_ID, `🆕 New Order #${newOrder.id}\n📦 ${packageName}\n📞 ${phone}\n💰 ${packageData.price.toLocaleString()} KS`);
    // No group message for new order (as requested)
    
    res.json({ success: true, orderId: newOrder.id });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Submit Payment (only admin receives, no group)
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
    console.log(`📸 Saving screenshot: ${screenshotPath}`);
    
    await database.updateOrderScreenshot(orderId, screenshotPath);
    await database.updateOrderStatus(orderId, 'payment_received');
    if (note) {
      await database.updateOrderNote(orderId, note);
    }
    
    // Admin gets full phone number
    const caption = `💰 Payment Received #${orderId}\n📦 ${order.packageName}\n📞 ${order.phone}\n💰 ${order.price.toLocaleString()} KS`;
    const keyboard = {
      inline_keyboard: [[
        { text: "✅ Approve (30 Days)", callback_data: `approve_${orderId}` },
        { text: "❌ Reject", callback_data: `reject_${orderId}` }
      ]]
    };
    await sendTelegramPhoto(ADMIN_CHAT_ID, fileBuffer, caption, keyboard);
    // No group message for payment received (as requested)
    
    res.json({ success: true, message: "Payment submitted!" });
  } catch (error) {
    console.error('Submit payment error:', error);
    res.status(500).json({ success: false, message: "Server error" });
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      console.log(`📁 Keeping screenshot file: ${tempFilePath}`);
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

// Debug screenshots endpoint
app.get('/debug/screenshots', isAuthenticated, async (req, res) => {
  try {
    const files = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : [];
    const fileList = files.map(file => ({
      name: file,
      url: `${BASE_URL}/temp_uploads/${file}`,
      path: `/temp_uploads/${file}`
    }));
    
    const orders = await database.getAllOrders();
    const dbScreenshots = orders.filter(o => o.screenshotPath).map(o => ({
      orderId: o.id,
      screenshotPath: o.screenshotPath,
      fullUrl: `${BASE_URL}${o.screenshotPath}`
    }));
    
    res.json({ 
      success: true, 
      uploadFolder: uploadDir,
      fileCount: files.length,
      files: fileList,
      dbScreenshots: dbScreenshots,
      baseUrl: BASE_URL
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Test group endpoint
app.get('/test-group', async (req, res) => {
  if (!GROUP_CHAT_ID) {
    return res.json({ success: false, error: "GROUP_CHAT_ID not set" });
  }
  const testMsg = `🧪 <b>Test Message</b>\n🕐 ${getMyanmarTime12hr().full}\n✅ Group notification is working!`;
  const result = await sendTelegramMessage(GROUP_CHAT_ID, testMsg);
  res.json({ success: result, groupId: GROUP_CHAT_ID });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});

const server = app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📱 Customer: ${BASE_URL}/`);
  console.log(`👑 Admin: ${BASE_URL}/admin`);
  console.log(`🔑 Admin Password: ${ADMIN_PASSWORD}`);
  console.log(`📸 Screenshot Debug: ${BASE_URL}/debug/screenshots`);
  console.log(`✅ Health Check: ${BASE_URL}/health\n`);
  
  try {
    database.startExpiryChecker(60);
  } catch (err) {
    console.error('Expiry checker error:', err.message);
  }
});

server.on('error', (err) => {
  console.error('Server error:', err.message);
});

module.exports = app;
