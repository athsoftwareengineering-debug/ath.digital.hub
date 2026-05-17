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

// Admin Credentials - Environment Variables ထည့်ထားရင် အဲဒါသုံးမယ်၊ မရှိရင် default သုံးမယ်
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "mytel2024";

// Server startup log မှာ ပြပေးမယ် (စစ်ဆေးရန်)
console.log(`\n🔐 ========== ADMIN CREDENTIALS ==========`);
console.log(`👤 Username: ${ADMIN_USERNAME}`);
console.log(`🔑 Password: ${ADMIN_PASSWORD}`);
console.log(`=========================================\n`);

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
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '.jpg');
  }
});
const upload = multer({ storage: storage });

// ========== TELEGRAM FUNCTIONS ==========
async function sendTelegramMessage(chatId, text, keyboard = null) {
  if (!BOT_TOKEN || !chatId) {
    console.log(`⚠️ Cannot send message: BOT_TOKEN=${!!BOT_TOKEN}, CHAT_ID=${!!chatId}`);
    return false;
  }
  
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const body = {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    };
    if (keyboard) {
      body.reply_markup = JSON.stringify(keyboard);
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    const result = await response.json();
    
    if (result.ok) {
      console.log(`✅ Telegram message sent to ${chatId}`);
    } else {
      console.log(`❌ Telegram error: ${result.description}`);
    }
    return result.ok;
  } catch (error) {
    console.error(`❌ Telegram send error: ${error.message}`);
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
    if (keyboard) {
      formData.append('reply_markup', JSON.stringify(keyboard));
    }
    
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    return result.ok;
  } catch (error) {
    console.error(`❌ Photo send error: ${error.message}`);
    return false;
  }
}

// ========== COUNTDOWN FUNCTIONS ==========
function calculateRemainingDays(endDate) {
  const today = new Date();
  const end = new Date(endDate);
  const diffTime = end - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function updateAllOrdersRemainingDays() {
  console.log('🔄 Running daily countdown check...');
  let updatedCount = 0;
  let expiredCount = 0;
  
  orders.forEach(order => {
    if (order.status === 'approved' && order.endDate) {
      const remaining = calculateRemainingDays(order.endDate);
      order.daysRemaining = remaining;
      
      if (remaining <= 0 && !order.isExpired) {
        order.isExpired = true;
        order.status = 'expired';
        expiredCount++;
        
        sendTelegramMessage(ADMIN_CHAT_ID, 
          `⏰ *EXPIRED* Order #${order.id}\n\n📞 ${order.phone}\n📦 ${order.packageName}\n📅 Ended: ${new Date(order.endDate).toLocaleDateString()}`
        );
      }
      
      const alertDays = [5, 3, 1];
      if (alertDays.includes(remaining) && order.lastAlertDay !== remaining && remaining > 0) {
        order.lastAlertDay = remaining;
        
        sendTelegramMessage(ADMIN_CHAT_ID,
          `⚠️ *REMINDER* Order #${order.id}\n\n📞 ${order.phone}\n📦 ${order.packageName}\n⏳ ${remaining} days remaining!\n📅 Expires: ${new Date(order.endDate).toLocaleDateString()}`
        );
        
        if (GROUP_CHAT_ID) {
          sendTelegramMessage(GROUP_CHAT_ID,
            `🔔 *Data Expiring Soon*\n\n📞 ${order.phone}\n⏳ ${remaining} days left!\n💨 Renew now!`
          );
        }
      }
      updatedCount++;
    }
  });
  
  console.log(`✅ Updated: ${updatedCount} orders | ⏰ Expired: ${expiredCount}`);
  return { updatedCount, expiredCount };
}

// Daily scheduler (runs every day at 9 AM)
function scheduleDailyTask() {
  const now = new Date();
  const next9AM = new Date();
  next9AM.setHours(9, 0, 0, 0);
  if (now > next9AM) {
    next9AM.setDate(next9AM.getDate() + 1);
  }
  
  const msUntil9AM = next9AM - now;
  console.log(`⏰ Next countdown check scheduled at: ${next9AM.toLocaleString()}`);
  
  setTimeout(() => {
    updateAllOrdersRemainingDays();
    scheduleDailyTask();
  }, msUntil9AM);
}

// Start the daily scheduler
scheduleDailyTask();

// Run once on startup
setTimeout(() => {
  updateAllOrdersRemainingDays();
}, 5000);

// ========== ADMIN AUTHENTICATION MIDDLEWARE ==========
function isAuthenticated(req, res, next) {
  const authToken = req.headers['x-admin-auth'];
  if (authToken === ADMIN_PASSWORD) {
    return next();
  }
  res.status(401).json({ success: false, message: "Unauthorized" });
}

// Protect admin API endpoints (except login)
app.use('/api/admin/*', (req, res, next) => {
  if (req.path === '/api/admin/login') {
    return next();
  }
  isAuthenticated(req, res, next);
});

// ========== API ENDPOINTS ==========

// ✅ Admin Login API
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  
  console.log(`📝 Login attempt: username="${username}", password length=${password?.length || 0}`);
  console.log(`🔑 Expected: username="${ADMIN_USERNAME}", password="${ADMIN_PASSWORD}"`);
  
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    console.log(`✅ Login successful for ${username}`);
    res.json({ success: true, message: "Login successful" });
  } else {
    console.log(`❌ Login failed for ${username}`);
    res.status(401).json({ success: false, message: "Invalid username or password" });
  }
});

// ✅ Create Order
app.post('/order', async (req, res) => {
  try {
    const { packageName, phone } = req.body;
    console.log(`📦 New order request: ${packageName} for ${phone}`);
    
    if (!packageName || !phone) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    
    const packageData = PACKAGES[packageName];
    if (!packageData) {
      return res.status(400).json({ success: false, message: "Invalid package" });
    }
    
    const newOrder = {
      id: orderIdCounter++,
      packageName,
      phone,
      price: packageData.price,
      status: "pending_payment",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      startDate: null,
      endDate: null,
      daysRemaining: null,
      isExpired: false,
      lastAlertDay: null
    };
    orders.unshift(newOrder);
    
    console.log(`✅ Order #${newOrder.id} created`);
    
    // Send notification to Admin via Telegram
    const adminMessage = `
🆕 *New Order Created* #${newOrder.id}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${packageName}
📞 Phone: ${phone}
💰 Price: ${packageData.price.toLocaleString()} KS
📅 Time: ${new Date().toLocaleString()}
    `;
    
    await sendTelegramMessage(ADMIN_CHAT_ID, adminMessage);
    
    res.json({ 
      success: true, 
      orderId: newOrder.id, 
      packageName, 
      price: packageData.price, 
      phone
    });
    
  } catch (error) {
    console.error("Order error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Submit Payment with Screenshot
app.post('/submit-payment', upload.single('screenshot'), async (req, res) => {
  let tempFilePath = null;
  
  try {
    const orderId = parseInt(req.body.orderId);
    const packageName = req.body.packageName;
    const phone = req.body.phone;
    const note = req.body.note || '';
    const screenshot = req.file;
    
    console.log(`💰 Payment submission for order #${orderId}`);
    
    if (!screenshot) {
      return res.status(400).json({ success: false, message: "Screenshot required" });
    }
    
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    
    order.status = 'payment_received';
    order.updatedAt = new Date().toISOString();
    
    tempFilePath = screenshot.path;
    const fileBuffer = fs.readFileSync(tempFilePath);
    
    const caption = `
💰 *Payment Received* #${orderId}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${order.packageName}
📞 Phone: ${order.phone}
💰 Amount: ${order.price.toLocaleString()} KS
📝 Note: ${note}
📅 Time: ${new Date().toLocaleString()}
    `;
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: "✅ Approve (Start 30 Days)", callback_data: `approve_${orderId}` },
          { text: "❌ Reject", callback_data: `reject_${orderId}` }
        ]
      ]
    };
    
    await sendTelegramPhoto(ADMIN_CHAT_ID, fileBuffer, caption, keyboard);
    
    res.json({ success: true, message: "Payment submitted! Admin will verify." });
    
  } catch (error) {
    console.error("Payment submit error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
});

// ✅ Track Order
app.get('/api/track-order', (req, res) => {
  const { orderId, phone } = req.query;
  
  if (!orderId || !phone) {
    return res.status(400).json({ success: false, message: "Order ID and Phone required" });
  }
  
  const order = orders.find(o => o.id === parseInt(orderId) && o.phone === phone);
  
  if (!order) {
    return res.json({ success: false, message: "Order not found" });
  }
  
  let countdownInfo = null;
  if (order.startDate && order.endDate) {
    const remaining = calculateRemainingDays(order.endDate);
    countdownInfo = {
      startDate: order.startDate,
      endDate: order.endDate,
      daysRemaining: remaining > 0 ? remaining : 0,
      isExpired: remaining <= 0,
      progressPercent: Math.max(0, (remaining / 30) * 100)
    };
  }
  
  res.json({
    success: true,
    order: {
      id: order.id,
      packageName: order.packageName,
      phone: order.phone,
      price: order.price,
      status: order.status,
      createdAt: order.createdAt,
      countdown: countdownInfo
    }
  });
});

// ✅ Admin Dashboard APIs
app.get('/api/admin/orders', (req, res) => {
  const { status, page = 1, limit = 50 } = req.query;
  
  let filtered = [...orders];
  if (status && status !== 'all') {
    filtered = filtered.filter(o => o.status === status);
  }
  
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
  
  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }
  
  if (status === 'approved' && !order.startDate) {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    
    order.startDate = startDate.toISOString();
    order.endDate = endDate.toISOString();
    order.daysRemaining = 30;
    order.status = 'approved';
    order.isExpired = false;
    
    await sendTelegramMessage(ADMIN_CHAT_ID, 
      `✅ Order #${orderId} approved! 30 days countdown started.\n📞 ${order.phone}\n📅 Expires: ${endDate.toLocaleDateString()}`
    );
    
    if (GROUP_CHAT_ID) {
      await sendTelegramMessage(GROUP_CHAT_ID, 
        `🚨 *DATA ACTIVATED* 🚨\n\n📞 ${order.phone}\n📦 ${order.packageName}\n⏳ 30 days valid\n💨 Enjoy high-speed data!`
      );
    }
  } else {
    order.status = status;
    await sendTelegramMessage(ADMIN_CHAT_ID, 
      `❌ Order #${orderId} ${status === 'rejected' ? 'rejected' : 'updated'}.`
    );
  }
  
  order.updatedAt = new Date().toISOString();
  res.json({ success: true, order });
});

app.get('/api/admin/stats', (req, res) => {
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending_payment').length,
    paid: orders.filter(o => o.status === 'payment_received').length,
    approved: orders.filter(o => o.status === 'approved').length,
    rejected: orders.filter(o => o.status === 'rejected').length,
    expired: orders.filter(o => o.status === 'expired').length,
    revenue: orders.filter(o => o.status === 'approved').reduce((sum, o) => sum + o.price, 0),
    activeCountdowns: orders.filter(o => o.status === 'approved' && !o.isExpired && o.endDate).length
  };
  res.json(stats);
});

// ========== TELEGRAM WEBHOOK ==========
app.post(`/webhook/${BOT_TOKEN}`, async (req, res) => {
  try {
    const { callback_query } = req.body;
    
    if (callback_query && callback_query.data) {
      const data = callback_query.data;
      const chatId = callback_query.message.chat.id;
      const messageId = callback_query.message.message_id;
      
      console.log(`📨 Webhook callback: ${data}`);
      
      // Answer callback query
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callback_query.id })
      });
      
      if (data.startsWith('approve_')) {
        const orderId = parseInt(data.split('_')[1]);
        const order = orders.find(o => o.id === orderId);
        
        if (order && !order.startDate) {
          const startDate = new Date();
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + 30);
          
          order.startDate = startDate.toISOString();
          order.endDate = endDate.toISOString();
          order.daysRemaining = 30;
          order.status = 'approved';
          order.isExpired = false;
          order.lastAlertDay = null;
          
          await sendTelegramMessage(chatId, 
            `✅ Order #${orderId} approved! 30 days countdown started.\n\n📞 ${order.phone}\n📦 ${order.packageName}\n📅 Expires: ${endDate.toLocaleDateString()}`
          );
          
          if (GROUP_CHAT_ID) {
            await sendTelegramMessage(GROUP_CHAT_ID, 
              `🚨 *DATA ACTIVATED* 🚨\n\n📞 ${order.phone}\n📦 ${order.packageName}\n⏳ 30 days valid\n💨 Enjoy high-speed data!`
            );
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
    console.error("Webhook error:", error);
    res.sendStatus(200);
  }
});

// ========== SERVE PAGES (Order is important!) ==========
app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== TEST ENDPOINT (အတည်ပြုရန်) ==========
app.get('/test-env', (req, res) => {
  res.json({
    botTokenSet: !!BOT_TOKEN,
    adminChatIdSet: !!ADMIN_CHAT_ID,
    groupChatIdSet: !!GROUP_CHAT_ID,
    adminUsername: ADMIN_USERNAME,
    adminPasswordSet: !!ADMIN_PASSWORD
  });
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 10000;

app.listen(PORT, async () => {
  console.log(`\n🚀 ========== SERVER STARTED ==========`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`========================================`);
  console.log(`📨 BOT_TOKEN: ${BOT_TOKEN ? '✅ SET' : '❌ MISSING'}`);
  console.log(`👤 ADMIN_CHAT_ID: ${ADMIN_CHAT_ID ? '✅ SET' : '❌ MISSING'}`);
  console.log(`👥 GROUP_CHAT_ID: ${GROUP_CHAT_ID ? '✅ SET' : '⚠️ OPTIONAL'}`);
  console.log(`========================================`);
  console.log(`🔐 ADMIN LOGIN:`);
  console.log(`   Username: ${ADMIN_USERNAME}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log(`========================================`);
  console.log(`📱 Customer Page: https://ath-digital-hub.onrender.com/`);
  console.log(`🔑 Admin Login: https://ath-digital-hub.onrender.com/admin-login`);
  console.log(`👑 Admin Dashboard: https://ath-digital-hub.onrender.com/admin`);
  console.log(`========================================\n`);
  
  // Set webhook
  if (BOT_TOKEN) {
    const webhookUrl = `https://ath-digital-hub.onrender.com/webhook/${BOT_TOKEN}`;
    console.log(`🔗 Setting webhook to: ${webhookUrl}`);
    
    try {
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
      const result = await response.json();
      console.log(`📡 Webhook: ${result.ok ? '✅ SUCCESS' : '❌ FAILED'} - ${result.description || ''}`);
    } catch (error) {
      console.error(`❌ Webhook error: ${error.message}`);
    }
  }
  
  // Send startup message to admin
  setTimeout(async () => {
    if (ADMIN_CHAT_ID && BOT_TOKEN) {
      await sendTelegramMessage(ADMIN_CHAT_ID, 
        `🤖 *MYTEL Bot is Online!*\n\n✅ Server started at ${new Date().toLocaleString()}\n🔧 Ready to receive orders.`
      );
    }
  }, 3000);
});
