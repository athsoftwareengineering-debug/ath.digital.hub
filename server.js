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

// Admin Credentials
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "mytel2024";

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
  } catch (error) { return false; }
}

// Edit message (to remove buttons after approve/reject)
async function editTelegramMessage(chatId, messageId, newText, keyboard = null) {
  if (!BOT_TOKEN || !chatId) return false;
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`;
    const body = { chat_id: chatId, message_id: messageId, text: newText, parse_mode: 'Markdown' };
    if (keyboard) body.reply_markup = JSON.stringify(keyboard);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await response.json();
    return result.ok;
  } catch (error) { return false; }
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
    return { ok: result.ok, message_id: result.result?.message_id };
  } catch (error) { return { ok: false }; }
}

// ========== COUNTDOWN FUNCTIONS ==========
function calculateRemainingDays(endDate) {
  const today = new Date();
  const end = new Date(endDate);
  const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
  return diffDays;
}

function updateAllOrdersRemainingDays() {
  orders.forEach(order => {
    if (order.status === 'approved' && order.endDate) {
      const remaining = calculateRemainingDays(order.endDate);
      order.daysRemaining = remaining;
      if (remaining <= 0 && !order.isExpired) {
        order.isExpired = true;
        order.status = 'expired';
        sendTelegramMessage(ADMIN_CHAT_ID, `⏰ EXPIRED: Order #${order.id}\n📞 ${order.phone}`);
      }
    }
  });
}

function scheduleDailyTask() {
  const now = new Date();
  const next9AM = new Date();
  next9AM.setHours(9, 0, 0, 0);
  if (now > next9AM) next9AM.setDate(next9AM.getDate() + 1);
  setTimeout(() => { updateAllOrdersRemainingDays(); scheduleDailyTask(); }, next9AM - now);
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
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    res.json({ success: true, message: "Login successful" });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

// ✅ Create Order (Customer က Website ကနေ Order တင်မယ်)
app.post('/order', async (req, res) => {
  try {
    const { packageName, phone } = req.body;
    console.log(`📦 New order: ${packageName} for ${phone}`);
    
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
    
    // Send notification to Admin (Customer က စာမရိုက်ရဘူး - Bot က auto ပို့ပေးမယ်)
    const adminMessage = `
🆕 *New Order* #${newOrder.id}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${packageName}
📞 Phone: ${phone}
💰 Price: ${packageData.price.toLocaleString()} KS
📅 Time: ${new Date().toLocaleString()}
━━━━━━━━━━━━━━━━━━━━
⏳ Status: Waiting for payment screenshot
    `;
    
    await sendTelegramMessage(ADMIN_CHAT_ID, adminMessage);
    
    res.json({ success: true, orderId: newOrder.id, packageName, price: packageData.price, phone });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Submit Payment with Screenshot
app.post('/submit-payment', upload.single('screenshot'), async (req, res) => {
  let tempFilePath = null;
  try {
    const orderId = parseInt(req.body.orderId);
    const screenshot = req.file;
    
    if (!screenshot) {
      return res.status(400).json({ success: false, message: "Screenshot required" });
    }
    
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    
    order.status = 'payment_received';
    tempFilePath = screenshot.path;
    const fileBuffer = fs.readFileSync(tempFilePath);
    
    const caption = `
💰 *Payment Received* #${orderId}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${order.packageName}
📞 Phone: ${order.phone}
💰 Amount: ${order.price.toLocaleString()} KS
📅 Time: ${new Date().toLocaleString()}
━━━━━━━━━━━━━━━━━━━━
✅ Please verify and approve
    `;
    
    const keyboard = {
      inline_keyboard: [
        [{ text: "✅ Approve (Start 30 Days)", callback_data: `approve_${orderId}` }],
        [{ text: "❌ Reject", callback_data: `reject_${orderId}` }]
      ]
    };
    
    const result = await sendTelegramPhoto(ADMIN_CHAT_ID, fileBuffer, caption, keyboard);
    
    // Store message ID to edit later (for removing buttons)
    if (result.ok && result.message_id) {
      order.telegramMessageId = result.message_id;
    }
    
    res.json({ success: true, message: "Payment submitted! Admin will verify." });
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
    countdownInfo = { daysRemaining: remaining > 0 ? remaining : 0, isExpired: remaining <= 0 };
  }
  res.json({ success: true, order: { ...order, countdown: countdownInfo } });
});

// Admin APIs
app.get('/api/admin/orders', (req, res) => {
  const { status, page = 1, limit = 50 } = req.query;
  let filtered = [...orders];
  if (status && status !== 'all') filtered = filtered.filter(o => o.status === status);
  filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const start = (parseInt(page) - 1) * parseInt(limit);
  const paginated = filtered.slice(start, start + parseInt(limit));
  const stats = {
    total: orders.length, pending: orders.filter(o => o.status === 'pending_payment').length,
    paid: orders.filter(o => o.status === 'payment_received').length, approved: orders.filter(o => o.status === 'approved').length,
    rejected: orders.filter(o => o.status === 'rejected').length, expired: orders.filter(o => o.status === 'expired').length,
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
    
    // Send to Admin
    await sendTelegramMessage(ADMIN_CHAT_ID, `✅ Order #${orderId} approved! 30 days started.\n📞 ${order.phone}`);
    
    // Send to Group
    if (GROUP_CHAT_ID) {
      const groupMessage = `
🚨 *MYTEL DATA ACTIVATED* 🚨
━━━━━━━━━━━━━━━━━━━━
✅ အော်ဒါ #${order.id} အတွက် ဒေတာသွင်းပြီးပါပြီ။
📞 ဖုန်းနံပါတ်: ${order.phone}
📦 Package: ${order.packageName}
💰 ပမာဏ: ${order.price.toLocaleString()} KS
📅 စတင်ရက်: ${startDate.toLocaleString()}
⏰ ကုန်ဆုံးရက်: ${endDate.toLocaleString()}
━━━━━━━━━━━━━━━━━━━━
👤 အတည်ပြုသူ: 𝐀𝐃𝐌𝐈𝐍 𝐒𝐔𝐏𝐏𝐎𝐑𝐓 | 𝟐𝟒/𝟕
      `;
      await sendTelegramMessage(GROUP_CHAT_ID, groupMessage);
    }
  } else {
    order.status = status;
    await sendTelegramMessage(ADMIN_CHAT_ID, `❌ Order #${orderId} ${status}.`);
  }
  
  res.json({ success: true, order });
});

// ========== TELEGRAM WEBHOOK (Buttons ပျောက်အောင် Edit လုပ်မယ်) ==========
app.post(`/webhook/${BOT_TOKEN}`, async (req, res) => {
  try {
    const { callback_query } = req.body;
    
    if (callback_query && callback_query.data) {
      const data = callback_query.data;
      const chatId = callback_query.message.chat.id;
      const messageId = callback_query.message.message_id;
      const originalCaption = callback_query.message.caption || "";
      
      // Answer callback query immediately
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
          
          // ✅ Edit the original message to remove buttons
          const newCaption = originalCaption + `\n\n✅ APPROVED! 30 days countdown started.\n📅 Expires: ${endDate.toLocaleDateString()}`;
          await editTelegramMessage(chatId, messageId, newCaption, null);
          
          // Send confirmation to admin
          await sendTelegramMessage(chatId, `✅ Order #${orderId} approved! 30 days started.`);
          
          // Send to Group
          if (GROUP_CHAT_ID) {
            const groupMessage = `
🚨 *MYTEL DATA ACTIVATED* 🚨
━━━━━━━━━━━━━━━━━━━━
✅ အော်ဒါ #${order.id} အတွက် ဒေတာသွင်းပြီးပါပြီ။
📞 ဖုန်းနံပါတ်: ${order.phone}
📦 Package: ${order.packageName}
💰 ပမာဏ: ${order.price.toLocaleString()} KS
📅 စတင်ရက်: ${startDate.toLocaleString()}
⏰ ကုန်ဆုံးရက်: ${endDate.toLocaleString()}
━━━━━━━━━━━━━━━━━━━━
👤 အတည်ပြုသူ: 𝐀𝐃𝐌𝐈𝐍 𝐒𝐔𝐏𝐏𝐎𝐑𝐓 | 𝟐𝟒/𝟕
            `;
            await sendTelegramMessage(GROUP_CHAT_ID, groupMessage);
          }
        }
      }
      
      if (data.startsWith('reject_')) {
        const orderId = parseInt(data.split('_')[1]);
        const order = orders.find(o => o.id === orderId);
        
        if (order) {
          order.status = 'rejected';
          
          // ❌ Edit the original message to remove buttons
          const newCaption = originalCaption + `\n\n❌ REJECTED! Please check payment details and try again.`;
          await editTelegramMessage(chatId, messageId, newCaption, null);
          
          await sendTelegramMessage(chatId, `❌ Order #${orderId} rejected.`);
          
          // Send to Group
          if (GROUP_CHAT_ID) {
            const rejectGroupMessage = `
⚠️ *အော်ဒါပယ်ဖျက်ခြင်း* ⚠️
━━━━━━━━━━━━━━━━━━━━
❌ အော်ဒါ #${order.id} အား ပယ်ဖျက်လိုက်ပါသည်။
📞 ဖုန်း: ${order.phone}
📦 Package: ${order.packageName}
📝 အကြောင်းရင်း: ငွေလွှဲ မှန်ကန်မှုမရှိပါ။
━━━━━━━━━━━━━━━━━━━━
⚠️ ကျေးဇူးပြု၍ ပြန်လည်စစ်ဆေးပါ။
👤 အတည်ပြုသူ: 𝐀𝐃𝐌𝐈𝐍 𝐒𝐔𝐏𝐏𝐎𝐑𝐓 | 𝟐𝟒/𝟕
            `;
            await sendTelegramMessage(GROUP_CHAT_ID, rejectGroupMessage);
          }
        }
      }
    }
    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook error:", error);
    res.sendStatus(200);
  }
});

// ========== SERVE PAGES ==========
app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`========================================`);
  console.log(`📨 BOT_TOKEN: ${BOT_TOKEN ? '✅' : '❌'}`);
  console.log(`👤 ADMIN_CHAT_ID: ${ADMIN_CHAT_ID ? '✅' : '❌'}`);
  console.log(`========================================`);
  console.log(`🔐 Admin: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
  console.log(`📱 Customer: https://ath-digital-hub.onrender.com/`);
  console.log(`🔑 Login: https://ath-digital-hub.onrender.com/admin-login`);
  console.log(`========================================\n`);
  
  if (BOT_TOKEN) {
    const webhookUrl = `https://ath-digital-hub.onrender.com/webhook/${BOT_TOKEN}`;
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
    const result = await response.json();
    console.log(`📡 Webhook: ${result.ok ? '✅' : '❌'}\n`);
  }
});
