const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
// ❌ node-cron မလိုတော့ဘူး

const app = express();

// ========== MIDDLEWARE ==========
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ========== FILE UPLOAD ==========
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

// ========== TELEGRAM BOT CONFIG ==========
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.CHAT_ID;
const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID || "-1003783137346";

// ========== DATA STORAGE ==========
let orders = [];
let orderIdCounter = 1;

const PACKAGES = {
  "VIP LEVEL - 1": { price: 15000, desc: "22GB / 8000 Mins / 5000 SMS" },
  "VIP LEVEL - 2": { price: 20000, desc: "40GB / 250 Mins / 25 Any Net" },
  "VIP LEVEL - 3": { price: 25000, desc: "40GB / 1400 Mins / 8000 SMS" },
  "VIP LEVEL - 4 (ULTRA)": { price: 30000, desc: "120GB High-Speed Data" }
};

// ========== HELPER FUNCTIONS ==========
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
  } catch (error) {
    console.error("Telegram send error:", error);
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
    console.error("Telegram photo error:", error);
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
  console.log('🔄 Running countdown check...');
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
          `⏰ **သက်တမ်းကုန်ဆုံးကြောင်း အကြောင်းကြားချက်**\n\n` +
          `📞 ဖုန်း: ${order.phone}\n` +
          `📦 Package: ${order.packageName}\n` +
          `📅 ကုန်ဆုံးရက်: ${new Date(order.endDate).toLocaleDateString('my-MM')}`
        );
      }
      
      const alertDays = [5, 3, 1];
      if (alertDays.includes(remaining) && order.lastAlertDay !== remaining && remaining > 0) {
        order.lastAlertDay = remaining;
        
        sendTelegramMessage(ADMIN_CHAT_ID,
          `⚠️ **ဒေတာသက်တမ်းကုန်ခါနီး အကြောင်းကြားချက်**\n\n` +
          `📞 ဖုန်း: ${order.phone}\n` +
          `📦 Package: ${order.packageName}\n` +
          `⏳ ကျန်ရက်: ${remaining} ရက်`
        );
        
        if (GROUP_CHAT_ID) {
          sendTelegramMessage(GROUP_CHAT_ID,
            `🔔 **သတိပေးချက်**\n\n` +
            `📞 ${order.phone}\n` +
            `⏳ ဒေတာသက်တမ်း ကုန်ဆုံးရန် **${remaining} ရက်** သာကျန်ပါသည်။\n` +
            `💨 အခုပဲ ပြန်လည်မှာယူနိုင်ပါသည်။`
          );
        }
      }
      updatedCount++;
    }
  });
  
  console.log(`✅ Updated ${updatedCount} orders | ⏰ Expired: ${expiredCount}`);
  return { updatedCount, expiredCount };
}

// ========== DAILY SCHEDULER (node-cron အစား) ==========
function scheduleDailyTask() {
  const now = new Date();
  const next9AM = new Date();
  next9AM.setHours(9, 0, 0, 0);
  
  if (now > next9AM) {
    next9AM.setDate(next9AM.getDate() + 1);
  }
  
  const msUntil9AM = next9AM - now;
  console.log(`⏰ Next countdown check at: ${next9AM.toLocaleString()}`);
  
  setTimeout(() => {
    updateAllOrdersRemainingDays();
    scheduleDailyTask(); // Schedule next day
  }, msUntil9AM);
}

// Start the daily scheduler
scheduleDailyTask();

// Run once on startup
setTimeout(() => {
  updateAllOrdersRemainingDays();
}, 5000);

// ========== API ENDPOINTS ==========

// Order endpoint
app.post('/order', async (req, res) => {
  try {
    const { packageName, phone } = req.body;
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
    
    console.log(`📦 Order #${newOrder.id} created for ${phone}`);
    
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

// Submit payment endpoint
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
    order.updatedAt = new Date().toISOString();
    
    tempFilePath = screenshot.path;
    const fileBuffer = fs.readFileSync(tempFilePath);
    
    const caption = `
🆕 **ငွေလွှဲပြေစာရရှိပါပြီ** #${orderId}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${order.packageName}
📞 ဖုန်း: ${order.phone}
💰 ငွေပမာဏ: ${order.price.toLocaleString()} KS
📅 အချိန်: ${new Date().toLocaleString('my-MM')}
    `;
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: "✅ အတည်ပြုမည် (30 ရက် စတင်မည်)", callback_data: `approve_${orderId}` },
          { text: "❌ ပယ်ဖျက်မည်", callback_data: `reject_${orderId}` }
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

// Track order endpoint
app.get('/api/track-order', (req, res) => {
  const { orderId, phone } = req.query;
  
  if (!orderId || !phone) {
    return res.status(400).json({ success: false, message: "Order ID and Phone required" });
  }
  
  const order = orders.find(o => o.id === parseInt(orderId) && o.phone === phone);
  
  if (!order) {
    return res.json({ success: false, message: "အော်ဒါမတွေ့ပါ။ ကျေးဇူးပြု၍ ပြန်စစ်ဆေးပါ။" });
  }
  
  let countdownInfo = null;
  if (order.startDate && order.endDate) {
    const remaining = calculateRemainingDays(order.endDate);
    countdownInfo = {
      startDate: order.startDate,
      endDate: order.endDate,
      daysRemaining: remaining > 0 ? remaining : 0,
      isExpired: remaining <= 0,
      statusMessage: remaining <= 0 ? "သက်တမ်းကုန်ဆုံးပါပြီ" : `ကျန်ရက် ${remaining} ရက်`
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

// Admin endpoints
app.get('/api/admin/active-orders', (req, res) => {
  const activeOrders = orders
    .filter(o => o.status === 'approved' && !o.isExpired)
    .map(o => ({
      id: o.id,
      phone: o.phone,
      packageName: o.packageName,
      startDate: o.startDate,
      endDate: o.endDate,
      daysRemaining: calculateRemainingDays(o.endDate),
      price: o.price
    }))
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
  
  res.json({ success: true, orders: activeOrders, count: activeOrders.length });
});

app.get('/orders-list', (req, res) => {
  res.json({ orders: orders, count: orders.length });
});

// ========== TELEGRAM WEBHOOK ==========
app.post(`/webhook/${BOT_TOKEN}`, async (req, res) => {
  try {
    const { callback_query } = req.body;
    
    if (callback_query && callback_query.data) {
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
        
        if (order) {
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
            `✅ အော်ဒါ #${orderId} အတည်ပြုပြီး Countdown 30 ရက် စတင်ပါပြီ။\n\n` +
            `📞 ${order.phone}\n` +
            `📦 ${order.packageName}\n` +
            `📅 ကုန်ဆုံးရက်: ${endDate.toLocaleDateString('my-MM')}`
          );
          
          if (GROUP_CHAT_ID) {
            await sendTelegramMessage(GROUP_CHAT_ID,
              `🚨 **ဒေတာသွင်းပြီးပါပြီ** 🚨\n\n` +
              `📞 ${order.phone}\n` +
              `📦 ${order.packageName}\n` +
              `⏳ 30 ရက်တိတိ အသုံးပြုနိုင်ပါပြီ။`
            );
          }
        }
      }
      
      if (data.startsWith('reject_')) {
        const orderId = parseInt(data.split('_')[1]);
        const order = orders.find(o => o.id === orderId);
        if (order) {
          order.status = 'rejected';
          await sendTelegramMessage(chatId, `❌ အော်ဒါ #${orderId} ပယ်ဖျက်ပြီး။`);
        }
      }
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook error:", error);
    res.sendStatus(200);
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== SERVER START ==========
const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📨 BOT_TOKEN: ${BOT_TOKEN ? '✅ Set' : '❌ Missing'}`);
  console.log(`👤 ADMIN_CHAT_ID: ${ADMIN_CHAT_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`👥 GROUP_CHAT_ID: ${GROUP_CHAT_ID ? '✅ Set' : '❌ Missing'}`);
  
  if (BOT_TOKEN) {
    const webhookUrl = `https://ath-digital-hub.onrender.com/webhook/${BOT_TOKEN}`;
    try {
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
      const result = await response.json();
      console.log("Webhook set:", result.ok ? "✅ Success" : "❌ Failed", result.description);
    } catch (error) {
      console.error("Webhook error:", error);
    }
  }
});
