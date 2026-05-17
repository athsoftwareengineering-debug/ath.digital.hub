const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();

// ========== MYANMAR TIME ZONE SETUP ==========
process.env.TZ = 'Asia/Yangon';

// 12 နာရီပုံစံ (AM/PM) နဲ့ မြန်မာချိန်ပြခြင်း
function getMyanmarTime12hr() {
  const now = new Date();
  return {
    full: now.toLocaleString('my-MM', { 
      timeZone: 'Asia/Yangon',
      hour12: true,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }),
    date: now.toLocaleDateString('my-MM', { timeZone: 'Asia/Yangon', year: 'numeric', month: '2-digit', day: '2-digit' }),
    time: now.toLocaleTimeString('my-MM', { timeZone: 'Asia/Yangon', hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    iso: now.toISOString(),
    timestamp: now.getTime()
  };
}

function formatMyanmarDate12hr(date) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString('my-MM', { 
    timeZone: 'Asia/Yangon',
    hour12: true,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// ========== MIDDLEWARE ==========
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ========== ENVIRONMENT VARIABLES ==========
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.CHAT_ID;
const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "mytel2024";

const myanmarTime = getMyanmarTime12hr();
console.log(`\n🔐 ========== ADMIN CREDENTIALS ==========`);
console.log(`🔑 Password: ${ADMIN_PASSWORD}`);
console.log(`🕐 Myanmar Time (12hr): ${myanmarTime.full}`);
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
    const myanmarTime = getMyanmarTime12hr();
    cb(null, myanmarTime.timestamp + '-' + Math.round(Math.random() * 1E9) + '.jpg');
  }
});
const upload = multer({ storage: storage });

// ========== TELEGRAM FUNCTIONS ==========
async function sendTelegramMessage(chatId, text, keyboard = null) {
  if (!BOT_TOKEN || !chatId) return false;
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const body = {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    };
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
    return result.ok;
  } catch (error) { return false; }
}

// ========== COUNTDOWN FUNCTIONS ==========
function calculateRemainingDays(endDate) {
  const now = new Date();
  const end = new Date(endDate);
  const diffTime = end - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function updateAllOrdersRemainingDays() {
  const myanmarTime = getMyanmarTime12hr();
  console.log(`🔄 Running daily countdown check... (${myanmarTime.full})`);
  
  orders.forEach(order => {
    if (order.status === 'approved' && order.endDate) {
      const remaining = calculateRemainingDays(order.endDate);
      order.daysRemaining = remaining;
      
      if (remaining <= 0 && !order.isExpired) {
        order.isExpired = true;
        order.status = 'expired';
        sendTelegramMessage(ADMIN_CHAT_ID, 
          `⏰ *EXPIRED* Order #${order.id}\n📞 ${order.phone}\n📅 ကုန်ဆုံးရက်: ${formatMyanmarDate12hr(order.endDate)}`
        );
      }
      
      const alertDays = [5, 3, 1];
      if (alertDays.includes(remaining) && order.lastAlertDay !== remaining && remaining > 0) {
        order.lastAlertDay = remaining;
        sendTelegramMessage(ADMIN_CHAT_ID,
          `⚠️ *REMINDER* Order #${order.id}\n📞 ${order.phone}\n⏳ ${remaining} ရက်သာကျန်ပါတော့သည်။\n📅 ကုန်ဆုံးရက်: ${formatMyanmarDate12hr(order.endDate)}`
        );
        
        if (GROUP_CHAT_ID) {
          sendTelegramMessage(GROUP_CHAT_ID,
            `🔔 *သတိပေးချက်*\n📞 ${order.phone}\n⏳ ${remaining} ရက်သာကျန်ပါတော့သည်။\n💨 အခုပဲ ပြန်လည်မှာယူနိုင်ပါသည်။`
          );
        }
      }
    }
  });
}

// Daily scheduler at 9 AM Myanmar time
function scheduleDailyTask() {
  const now = new Date();
  const next9AM = new Date();
  next9AM.setHours(9, 0, 0, 0);
  if (now > next9AM) next9AM.setDate(next9AM.getDate() + 1);
  
  const msUntil9AM = next9AM - now;
  console.log(`⏰ Next countdown check at: ${next9AM.toLocaleString('my-MM', { timeZone: 'Asia/Yangon', hour12: true })}`);
  
  setTimeout(() => {
    updateAllOrdersRemainingDays();
    scheduleDailyTask();
  }, msUntil9AM);
}
scheduleDailyTask();
setTimeout(() => updateAllOrdersRemainingDays(), 5000);

// ========== API ENDPOINTS ==========

// Create Order
app.post('/order', async (req, res) => {
  try {
    const { packageName, phone } = req.body;
    const myanmarTime = getMyanmarTime12hr();
    console.log(`📦 New order: ${packageName} for ${phone} (${myanmarTime.full})`);
    
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
      createdAt: myanmarTime.iso,
      createdAtMyanmar: myanmarTime.full,
      updatedAt: myanmarTime.iso,
      startDate: null, endDate: null,
      daysRemaining: null, isExpired: false, lastAlertDay: null
    };
    orders.unshift(newOrder);
    
    const adminMessage = `
🆕 *New Order* #${newOrder.id}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${packageName}
📞 Phone: ${phone}
💰 Price: ${packageData.price.toLocaleString()} KS
🕐 အချိန်: ${myanmarTime.full}
    `;
    await sendTelegramMessage(ADMIN_CHAT_ID, adminMessage);
    
    res.json({ success: true, orderId: newOrder.id, packageName, price: packageData.price, phone });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Submit Payment
app.post('/submit-payment', upload.single('screenshot'), async (req, res) => {
  let tempFilePath = null;
  try {
    const orderId = parseInt(req.body.orderId);
    const screenshot = req.file;
    const myanmarTime = getMyanmarTime12hr();
    
    if (!screenshot) return res.status(400).json({ success: false, message: "Screenshot required" });
    
    const order = orders.find(o => o.id === orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    
    order.status = 'payment_received';
    order.updatedAt = myanmarTime.iso;
    
    tempFilePath = screenshot.path;
    const fileBuffer = fs.readFileSync(tempFilePath);
    
    const caption = `
💰 *Payment Received* #${orderId}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${order.packageName}
📞 Phone: ${order.phone}
💰 Amount: ${order.price.toLocaleString()} KS
🕐 အချိန်: ${myanmarTime.full}
    `;
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
      startDate: formatMyanmarDate12hr(order.startDate),
      endDate: formatMyanmarDate12hr(order.endDate),
      daysRemaining: remaining > 0 ? remaining : 0,
      isExpired: remaining <= 0
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
      createdAt: formatMyanmarDate12hr(order.createdAt),
      countdown: countdownInfo
    }
  });
});

// Admin APIs with Authorization
app.get('/api/admin/orders', (req, res) => {
  const authToken = req.headers['x-admin-auth'];
  if (authToken !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  
  const { status, page = 1, limit = 50 } = req.query;
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
  
  const formattedOrders = paginated.map(o => ({
    ...o,
    createdAtMyanmar: formatMyanmarDate12hr(o.createdAt),
    startDateMyanmar: o.startDate ? formatMyanmarDate12hr(o.startDate) : null,
    endDateMyanmar: o.endDate ? formatMyanmarDate12hr(o.endDate) : null
  }));
  
  res.json({ success: true, orders: formattedOrders, total: filtered.length, stats });
});

app.post('/api/admin/update-order', async (req, res) => {
  const authToken = req.headers['x-admin-auth'];
  if (authToken !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  
  const { orderId, status } = req.body;
  const order = orders.find(o => o.id === parseInt(orderId));
  if (!order) return res.status(404).json({ success: false });
  
  const myanmarTime = getMyanmarTime12hr();
  
  if (status === 'approved' && !order.startDate) {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    
    order.startDate = startDate.toISOString();
    order.endDate = endDate.toISOString();
    order.daysRemaining = 30;
    order.status = 'approved';
    order.isExpired = false;
    order.updatedAt = myanmarTime.iso;
    
    await sendTelegramMessage(ADMIN_CHAT_ID, 
      `✅ Order #${orderId} approved! 30 days started.\n📞 ${order.phone}\n📅 စတင်ရက်: ${formatMyanmarDate12hr(startDate)}\n📅 ကုန်ဆုံးရက်: ${formatMyanmarDate12hr(endDate)}`
    );
    
    if (GROUP_CHAT_ID) {
      const groupMessage = `
🚨 *MYTEL DATA ACTIVATED* 🚨
━━━━━━━━━━━━━━━━━━━━
✅ အော်ဒါ #${order.id} အတွက် ဒေတာသွင်းပြီးပါပြီ။
📞 ဖုန်းနံပါတ်: ${order.phone}
📦 Package: ${order.packageName}
💰 ပမာဏ: ${order.price.toLocaleString()} KS
📅 စတင်ရက်: ${formatMyanmarDate12hr(startDate)}
⏰ ကုန်ဆုံးရက်: ${formatMyanmarDate12hr(endDate)}
━━━━━━━━━━━━━━━━━━━━
👤 အတည်ပြုသူ: 𝐀𝐃𝐌𝐈𝐍 𝐒𝐔𝐏𝐏𝐎𝐑𝐓 | 𝟐𝟒/𝟕
      `;
      await sendTelegramMessage(GROUP_CHAT_ID, groupMessage);
    }
  } else {
    order.status = status;
    order.updatedAt = myanmarTime.iso;
    await sendTelegramMessage(ADMIN_CHAT_ID, `❌ Order #${orderId} ${status}.`);
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
          const startDate = new Date();
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + 30);
          
          order.startDate = startDate.toISOString();
          order.endDate = endDate.toISOString();
          order.daysRemaining = 30;
          order.status = 'approved';
          
          await sendTelegramMessage(chatId, 
            `✅ Order #${orderId} approved! 30 days started.\n📅 စတင်ရက်: ${formatMyanmarDate12hr(startDate)}\n📅 ကုန်ဆုံးရက်: ${formatMyanmarDate12hr(endDate)}`
          );
          
          if (GROUP_CHAT_ID) {
            await sendTelegramMessage(GROUP_CHAT_ID, 
              `🚨 *MYTEL DATA ACTIVATED* 🚨\n━━━━━━━━━━━━━━━━━━━━\n✅ အော်ဒါ #${order.id} အတွက် ဒေတာသွင်းပြီးပါပြီ။\n📞 ${order.phone}\n📦 ${order.packageName}\n💰 ${order.price.toLocaleString()} KS\n📅 စတင်ရက်: ${formatMyanmarDate12hr(startDate)}\n⏰ ကုန်ဆုံးရက်: ${formatMyanmarDate12hr(endDate)}\n━━━━━━━━━━━━━━━━━━━━\n👤 𝐀𝐃𝐌𝐈𝐍 𝐒𝐔𝐏𝐏𝐎𝐑𝐓 | 𝟐𝟒/𝟕`
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
          
          if (GROUP_CHAT_ID) {
            await sendTelegramMessage(GROUP_CHAT_ID,
              `⚠️ *အော်ဒါပယ်ဖျက်ခြင်း* ⚠️\n━━━━━━━━━━━━━━━━━━━━\n❌ အော်ဒါ #${order.id} အား ပယ်ဖျက်လိုက်ပါသည်။\n📞 ${order.phone}\n📦 ${order.packageName}\n📝 အကြောင်းရင်း: ငွေလွှဲ မှန်ကန်မှုမရှိပါ။\n━━━━━━━━━━━━━━━━━━━━\n👤 𝐀𝐃𝐌𝐈𝐍 𝐒𝐔𝐏𝐏𝐎𝐑𝐓 | 𝟐𝟒/𝟕`
            );
          }
        }
      }
    }
    res.sendStatus(200);
  } catch (error) { res.sendStatus(200); }
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
  const myanmarTime = getMyanmarTime12hr();
  console.log(`\n🚀 ========== SERVER STARTED ==========`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🕐 Myanmar Time (12hr): ${myanmarTime.full}`);
  console.log(`========================================`);
  console.log(`📨 BOT_TOKEN: ${BOT_TOKEN ? '✅' : '❌'}`);
  console.log(`👤 ADMIN_CHAT_ID: ${ADMIN_CHAT_ID ? '✅' : '❌'}`);
  console.log(`========================================`);
  console.log(`🔑 Admin Password: ${ADMIN_PASSWORD}`);
  console.log(`📱 Customer: https://ath-digital-hub.onrender.com/`);
  console.log(`👑 Admin: https://ath-digital-hub.onrender.com/admin`);
  console.log(`========================================\n`);
  
  if (BOT_TOKEN) {
    const webhookUrl = `https://ath-digital-hub.onrender.com/webhook/${BOT_TOKEN}`;
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
    const result = await response.json();
    console.log(`📡 Webhook: ${result.ok ? '✅' : '❌'}\n`);
  }
});
// Get screenshot URL for an order
app.get('/api/admin/order-screenshot', (req, res) => {
  const authToken = req.headers['x-admin-auth'];
  if (authToken !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  
  const orderId = parseInt(req.query.orderId);
  const order = orders.find(o => o.id === orderId);
  
  // Return placeholder - in real system, you'd store screenshot URLs
  res.json({ 
    success: true, 
    screenshotUrl: order?.screenshotUrl || null,
    message: order?.screenshotUrl ? 'Screenshot found' : 'No screenshot available'
  });
});
