const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// ========== FIREBASE ADMIN ==========
const admin = require('firebase-admin');

// ========== EXPRESS APP ==========
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
const ALARM_GROUP_ID = "-1002373340084";
const PRODUCT_CHANNEL_ID = "@athdigitalhub";

// ========== FIREBASE INITIALIZATION (NO ERROR IF NOT CONFIGURED) ==========
let db = null;
let orders = [];
let orderIdCounter = 1;
let pendingOrders = {};

const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;

function fixPrivateKey(key) {
  if (!key) return key;
  return key.replace(/\\n/g, '\n');
}

if (serviceAccountRaw) {
  try {
    let serviceAccount = JSON.parse(serviceAccountRaw);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = fixPrivateKey(serviceAccount.private_key);
    }
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://mytelordersystem-default-rtdb.firebaseio.com"
    });
    db = admin.database();
    console.log("✅ Firebase connected successfully");
    
    // Load existing orders from Firebase on startup
    db.ref('orders').once('value', (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loadedOrders = Object.values(data);
        orders = loadedOrders.sort((a, b) => b.id - a.id);
        if (orders.length > 0) {
          orderIdCounter = Math.max(...orders.map(o => o.id)) + 1;
        }
        console.log(`📦 Loaded ${orders.length} orders from Firebase`);
      }
    });
  } catch (error) {
    console.error("❌ Firebase initialization error:", error.message);
    console.log("⚠️ Running without Firebase (in-memory storage fallback)");
  }
} else {
  console.log("⚠️ FIREBASE_SERVICE_ACCOUNT not set, running without Firebase");
}

// ========== FIREBASE HELPER FUNCTIONS ==========
async function saveOrderToFirebase(order) {
  if (!db) return null;
  try {
    await db.ref(`orders/${order.id}`).set(order);
    return true;
  } catch (error) {
    console.error("Firebase save error:", error);
    return false;
  }
}

async function updateOrderInFirebase(orderId, data) {
  if (!db) return null;
  try {
    await db.ref(`orders/${orderId}`).update(data);
    return true;
  } catch (error) {
    console.error("Firebase update error:", error);
    return false;
  }
}

async function getAllOrdersFromFirebase() {
  if (!db) return orders;
  try {
    const snapshot = await db.ref('orders').once('value');
    const data = snapshot.val();
    if (!data) return [];
    return Object.values(data).sort((a, b) => b.id - a.id);
  } catch (error) {
    console.error("Firebase getAll error:", error);
    return orders;
  }
}

// ========== MYANMAR TIME HELPER ==========
function getMyanmarTime() {
  const now = new Date();
  const myanmarTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Yangon" }));
  
  const days = ['တနင်္ဂနွေ', 'တနင်္လာ', 'အင်္ဂါ', 'ဗုဒ္ဓဟူး', 'ကြာသပတေး', 'သောကြာ', 'စနေ'];
  const months = ['ဇန်နဝါရီ', 'ဖေဖော်ဝါရီ', 'မတ်', 'ဧပြီ', 'မေ', 'ဇွန်', 'ဇူလိုင်', 'ဩဂုတ်', 'စက်တင်ဘာ', 'အောက်တိုဘာ', 'နိုဝင်ဘာ', 'ဒီဇင်ဘာ'];
  
  const year = myanmarTime.getFullYear();
  const month = months[myanmarTime.getMonth()];
  const day = days[myanmarTime.getDay()];
  const date = myanmarTime.getDate();
  
  let hours = myanmarTime.getHours();
  const minutes = myanmarTime.getMinutes().toString().padStart(2, '0');
  const seconds = myanmarTime.getSeconds().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'နေ့လည်' : 'နံနက်';
  hours = hours % 12 || 12;
  
  return {
    fullDateTime: `${date}/${myanmarTime.getMonth()+1}/${year} ${hours}:${minutes} ${ampm}`,
    full: `${year} ခုနှစ် ${month}လ ${date}ရက် ${day}နေ့ ${ampm} ${hours}:${minutes}:${seconds}`,
    date: `${date}/${myanmarTime.getMonth()+1}/${year}`,
    time: `${hours}:${minutes} ${ampm}`,
    timestamp: myanmarTime.getTime()
  };
}

// ========== EXPIRY DATE HELPER ==========
function getExpiryDate(startDate) {
  const expiry = new Date(startDate);
  expiry.setDate(expiry.getDate() + 30);
  return expiry;
}

function getRemainingDays(expiryDate) {
  const today = new Date();
  const diffTime = expiryDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

// ========== PAYMENT INFO ==========
const PAYMENT_INFO = {
  kpay: "09789999368",
  wavepay: "09789999368",
  name: "AUNG THU HTWE"
};

const PACKAGES = {
  "VIP LEVEL - 1": { price: 15000, desc: "22GB / 8000 Mins / 5000 SMS" },
  "VIP LEVEL - 2": { price: 20000, desc: "40GB / 250 Mins / 25 Any Net" },
  "VIP LEVEL - 3": { price: 25000, desc: "40GB / 1400 Mins / 8000 SMS" },
  "VIP LEVEL - 4 (ULTRA)": { price: 30000, desc: "120GB High-Speed Data" }
};

// ========== HELPER FUNCTIONS ==========
async function updateOrderStatus(orderId, status) {
  const order = orders.find(o => o.id == orderId);
  if (order) {
    order.status = status;
    order.updatedAt = new Date().toISOString();
    if (db) {
      await updateOrderInFirebase(orderId, { status, updatedAt: order.updatedAt });
    }
  }
  return order;
}

async function getOrderStats() {
  const allOrders = db ? await getAllOrdersFromFirebase() : orders;
  const pending = allOrders.filter(o => o.status === 'pending_payment').length;
  const received = allOrders.filter(o => o.status === 'payment_received').length;
  const approved = allOrders.filter(o => o.status === 'approved').length;
  const rejected = allOrders.filter(o => o.status === 'rejected').length;
  return `📊 *စာရင်းအင်း*\n⏳ ဆိုင်းငံ့: ${pending}\n💰 ငွေလွှဲပြီး: ${received}\n✅ အတည်ပြုပြီး: ${approved}\n❌ ပယ်ဖျက်ပြီး: ${rejected}`;
}

// ========== SEND TELEGRAM MESSAGE ==========
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
    console.log("Telegram send:", result.ok ? "✅" : "❌", result.description);
    return result.ok;
  } catch (error) {
    console.error("Telegram send error:", error);
    return false;
  }
}

// Send photo to Telegram
async function sendTelegramPhoto(chatId, buffer, caption, keyboard = null) {
  if (!BOT_TOKEN) return false;
  try {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('photo', new Blob([buffer], { type: 'image/jpeg' }), 'screenshot.jpg');
    form.append('caption', caption);
    form.append('parse_mode', 'Markdown');
    if (keyboard) form.append('reply_markup', JSON.stringify(keyboard));
    
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: form
    });
    const result = await response.json();
    console.log("Telegram photo:", result.ok ? "✅" : "❌", result.description);
    return result.ok;
  } catch (error) {
    console.error("Telegram photo error:", error);
    return false;
  }
}

// ========== AUTO REMINDER SYSTEM (Runs every day at 9 AM Myanmar Time) ==========
async function checkAndSendReminders() {
  console.log("🔔 Running auto reminder check...");
  
  const allOrders = db ? await getAllOrdersFromFirebase() : orders;
  const activeOrders = allOrders.filter(o => o.status === 'approved' && o.expiryDate);
  
  for (const order of activeOrders) {
    const expiryDate = new Date(order.expiryDate);
    const remainingDays = getRemainingDays(expiryDate);
    const myanmarTime = getMyanmarTime();
    
    // Send reminder when 3, 2, 1 days remaining
    if (remainingDays === 3 || remainingDays === 2 || remainingDays === 1) {
      const reminderMsg = `
╔════════════════════════════════════════════════════════════╗
║                    ⚠️ သတိပေးချက် ⚠️                       ║
╠════════════════════════════════════════════════════════════╣
║  🆔 အော်ဒါအမှတ်      : #${order.id}                       ║
║  📞 ဖုန်းနံပါတ်       : ${order.phone.slice(0, -4) + "****"}║
║  📦 Package          : ${order.packageName}                ║
║  📅 သက်တမ်းကုန်ဆုံးရက် : ${order.expiryDate}               ║
║  ⏳ ကျန်ရက်များ       : ${remainingDays} ရက်                ║
╠════════════════════════════════════════════════════════════╣
║  📢 ကျေးဇူးပြု၍ သက်တမ်းတိုးရန် အမြန်ဆုံးဖြည့်သွင်းပါ။     ║
║  🛒 ပြန်လည်ဝယ်ယူရန် : https://ath-digital-hub.onrender.com ║
╚════════════════════════════════════════════════════════════╝
      `;
      
      // Send reminder to customer if we have their chat ID
      if (order.customerChatId) {
        await sendTelegramMessage(order.customerChatId, reminderMsg);
        console.log(`📢 Reminder sent to customer for order #${order.id} (${remainingDays} days left)`);
      }
    }
    
    // Send expiry notification when 0 days remaining
    if (remainingDays === 0) {
      const expiryMsg = `
╔════════════════════════════════════════════════════════════╗
║                  ❌ သက်တမ်းကုန်ဆုံးပါပြီ ❌                 ║
╠════════════════════════════════════════════════════════════╣
║  🆔 အော်ဒါအမှတ်      : #${order.id}                       ║
║  📞 ဖုန်းနံပါတ်       : ${order.phone.slice(0, -4) + "****"}║
║  📦 Package          : ${order.packageName}                ║
║  📅 သက်တမ်းကုန်ဆုံးရက် : ${order.expiryDate}               ║
╠════════════════════════════════════════════════════════════╣
║  🛒 ပြန်လည်ဝယ်ယူရန် : https://ath-digital-hub.onrender.com ║
╚════════════════════════════════════════════════════════════╝
      `;
      
      if (order.customerChatId) {
        await sendTelegramMessage(order.customerChatId, expiryMsg);
        console.log(`📢 Expiry notification sent to customer for order #${order.id}`);
      }
    }
  }
}

// Schedule reminder check every day at 9 AM Myanmar Time
function scheduleReminderCheck() {
  const scheduleNextCheck = () => {
    const now = new Date();
    const myanmarNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Yangon" }));
    const nextCheck = new Date(myanmarNow);
    nextCheck.setHours(9, 0, 0, 0);
    
    if (myanmarNow >= nextCheck) {
      nextCheck.setDate(nextCheck.getDate() + 1);
    }
    
    const msUntilNext = nextCheck - myanmarNow;
    console.log(`⏰ Next reminder check scheduled in ${Math.round(msUntilNext / 1000 / 60)} minutes`);
    
    setTimeout(() => {
      checkAndSendReminders();
      scheduleReminderCheck();
    }, msUntilNext);
  };
  
  scheduleNextCheck();
}

// Start reminder scheduler if Bot is configured
if (BOT_TOKEN) {
  scheduleReminderCheck();
}

// ========== WEBSITE ORDER ENDPOINT ==========
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
      updatedAt: new Date().toISOString()
    };
    orders.unshift(newOrder);
    pendingOrders[newOrder.id] = newOrder;
    
    if (db) {
      await saveOrderToFirebase(newOrder);
    }
    
    console.log(`📦 Order #${newOrder.id} created - waiting for screenshot`);
    
    res.json({ 
      success: true, 
      orderId: newOrder.id, 
      packageName, 
      price: packageData.price, 
      phone, 
      paymentInfo: PAYMENT_INFO 
    });
  } catch (error) {
    console.error("Order error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ========== SUBMIT PAYMENT SCREENSHOT ==========
app.post('/submit-payment', upload.single('screenshot'), async (req, res) => {
  let tempFilePath = null;
  
  try {
    console.log("🔔 Payment submission received");
    
    const orderId = parseInt(req.body.orderId);
    const packageName = req.body.packageName;
    const phone = req.body.phone;
    const note = req.body.note;
    const screenshot = req.file;
    
    if (!screenshot) {
      return res.status(400).json({ success: false, message: "Screenshot required" });
    }
    
    if (!orderId) {
      return res.status(400).json({ success: false, message: "Order ID required" });
    }
    
    await updateOrderStatus(orderId, 'payment_received');
    
    const order = orders.find(o => o.id === orderId);
    const packageData = PACKAGES[order.packageName];
    
    tempFilePath = screenshot.path;
    const fileBuffer = fs.readFileSync(tempFilePath);
    
    const caption = `
🆕 **အော်ဒါအသစ် + ငွေလွှဲပြေစာ** #${orderId}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${order.packageName}
📞 ဖုန်း: ${order.phone}
💰 ငွေပမာဏ: ${packageData.price.toLocaleString()} KS
📝 မှတ်ချက်: ${note || "မရှိ"}
📅 အချိန်: ${getMyanmarTime().fullDateTime}
━━━━━━━━━━━━━━━━━━━━
⏳ **အတည်ပြုရန် အသင့်** - အောက်ပါခလုတ်များကို နှိပ်ပါ။
    `;
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: "✅ အတည်ပြုမည်", callback_data: `approve_${orderId}` },
          { text: "❌ ပယ်ဖျက်မည်", callback_data: `reject_${orderId}` }
        ],
        [{ text: "📋 အသေးစိတ်", callback_data: `detail_${orderId}` }]
      ]
    };
    
    await sendTelegramPhoto(ADMIN_CHAT_ID, fileBuffer, caption, keyboard);
    delete pendingOrders[orderId];
    
    res.json({ success: true, message: "Order and payment submitted! Admin will verify." });
    
  } catch (error) {
    console.error("Payment submit error:", error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
});

// ========== CHECK REMAINING DAYS API (For Website Button) ==========
app.post('/check-remaining', async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ success: false, message: "ဖုန်းနံပါတ် ထည့်သွင်းပါ" });
    }
    
    const allOrders = db ? await getAllOrdersFromFirebase() : orders;
    const activeOrders = allOrders.filter(o => o.phone === phone && o.status === 'approved');
    
    if (activeOrders.length === 0) {
      return res.json({ 
        success: true, 
        hasOrder: false, 
        message: "သင့်အတွက် active ဖြစ်နေသော အော်ဒါမရှိပါ။" 
      });
    }
    
    const ordersWithRemaining = activeOrders.map(order => {
      const startDate = new Date(order.createdAt);
      const expiryDate = order.expiryDate ? new Date(order.expiryDate) : getExpiryDate(startDate);
      const remainingDays = getRemainingDays(expiryDate);
      const isExpired = remainingDays <= 0;
      
      return {
        id: order.id,
        packageName: order.packageName,
        phone: order.phone,
        startDate: startDate.toLocaleDateString('en-GB'),
        expiryDate: expiryDate.toLocaleDateString('en-GB'),
        remainingDays: remainingDays,
        isExpired: isExpired
      };
    });
    
    res.json({ success: true, hasOrder: true, orders: ordersWithRemaining });
    
  } catch (error) {
    console.error("Check remaining error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ========== TELEGRAM WEBHOOK ==========
app.post(`/webhook/${BOT_TOKEN}`, async (req, res) => {
  try {
    const { message, callback_query } = req.body;
    
    if (callback_query) {
      const chatId = callback_query.message.chat.id;
      const data = callback_query.data;
      const messageId = callback_query.message.message_id;
      
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callback_query.id })
      });
      
      // ========== APPROVE BUTTON ==========
      if (data.startsWith('approve_')) {
        const orderId = parseInt(data.split('_')[1]);
        const order = orders.find(o => o.id === orderId);
        
        if (order) {
          const startDate = new Date();
          const expiryDate = getExpiryDate(startDate);
          const myanmarTime = getMyanmarTime();
          
          order.status = 'approved';
          order.updatedAt = startDate.toISOString();
          order.startDate = startDate.toISOString();
          order.expiryDate = expiryDate.toLocaleDateString('en-GB');
          
          if (db) {
            await updateOrderInFirebase(orderId, {
              status: 'approved',
              updatedAt: order.updatedAt,
              startDate: order.startDate,
              expiryDate: order.expiryDate
            });
          }
          
          await sendTelegramMessage(chatId, `✅ အော်ဒါ #${orderId} အတည်ပြုပြီးပါပြီ။\n📞 ${order.phone}\n📦 ${order.packageName}\n📅 သက်တမ်းကုန်ဆုံးရက်: ${order.expiryDate}`);
          
          // Send ALARM to GROUP
          const alarmMessage = `
╔════════════════════════════════════════════════════════════╗
║                ✅ ဒေတာ ထည့်သွင်းပြီးပါပြီ ✅                 ║
╠════════════════════════════════════════════════════════════╣
║  🆔 အော်ဒါအမှတ်      : #${orderId}                        ║
║  📦 Package          : ${order.packageName}                ║
║  📞 ဖုန်းနံပါတ်       : ${order.phone.slice(0, -4) + "****"}║
║  💰 ငွေပမာဏ          : ${order.price.toLocaleString()} KS  ║
║  ✅ အခြေအနေ          : အောင်မြင်ပြီး                      ║
║  📅 စတင်ရက်          : ${myanmarTime.date}                ║
║  📅 သက်တမ်းကုန်ဆုံးရက် : ${order.expiryDate}               ║
║  ⏰ အချိန်            : ${myanmarTime.time}                ║
╠════════════════════════════════════════════════════════════╣
║  🎉 ကျေးဇူးတင်ပါတယ်။                                      ║
║      ဒေတာ အသက်ဝင်ပါပြီ။                                   ║
╚════════════════════════════════════════════════════════════╝
          `;
          await sendTelegramMessage(ALARM_GROUP_ID, alarmMessage);
          console.log(`📢 Alarm sent to group for order #${orderId}`);
          
          // Edit the original message
          const approveCaption = `
✅ **အတည်ပြုပြီး** - အော်ဒါ #${orderId}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${order.packageName}
📞 ဖုန်း: ${order.phone}
💰 ငွေပမာဏ: ${order.price.toLocaleString()} KS
📅 စတင်ရက်: ${myanmarTime.date}
📅 သက်တမ်းကုန်ဆုံးရက်: ${order.expiryDate}
━━━━━━━━━━━━━━━━━━━━
🎉 ဒေတာ သွင်းပေးပါမည်။ ကျေးဇူးတင်ပါသည်။
          `;
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageCaption`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              caption: approveCaption,
              parse_mode: 'Markdown'
            })
          });
        }
        return res.sendStatus(200);
      }
      
      // ========== REJECT BUTTON ==========
      if (data.startsWith('reject_')) {
        const orderId = parseInt(data.split('_')[1]);
        const order = orders.find(o => o.id === orderId);
        
        if (order) {
          await updateOrderStatus(orderId, 'rejected');
          
          await sendTelegramMessage(chatId, `❌ အော်ဒါ #${orderId} ပယ်ဖျက်ပြီး။\n📞 ${order.phone}`);
          
          const rejectCaption = `
❌ **ပယ်ဖျက်ပြီး** - အော်ဒါ #${orderId}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${order.packageName}
📞 ဖုန်း: ${order.phone}
💰 ငွေပမာဏ: ${order.price.toLocaleString()} KS
━━━━━━━━━━━━━━━━━━━━
⚠️ ငွေလွှဲပြေစာ မှားယွင်းနေပါသည်။
          `;
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageCaption`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              caption: rejectCaption,
              parse_mode: 'Markdown'
            })
          });
        }
        return res.sendStatus(200);
      }
      
      // ========== DETAIL BUTTON ==========
      if (data.startsWith('detail_')) {
        const orderId = parseInt(data.split('_')[1]);
        const order = orders.find(o => o.id === orderId);
        
        if (order) {
          const statusEmoji = {
            'pending_payment': '⏳ ဆိုင်းငံ့',
            'payment_received': '💰 ငွေလွှဲပြီး',
            'approved': '✅ အတည်ပြုပြီး',
            'rejected': '❌ ပယ်ဖျက်ပြီး'
          }[order.status] || order.status;
          
          let extraInfo = '';
          if (order.status === 'approved' && order.expiryDate) {
            const remainingDays = getRemainingDays(new Date(order.expiryDate));
            extraInfo = `\n📅 သက်တမ်းကုန်ဆုံးရက်: ${order.expiryDate}\n⏳ ကျန်ရက်: ${remainingDays} ရက်`;
          }
          
          const detailMsg = `
📋 **အော်ဒါအသေးစိတ်** #${order.id}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${order.packageName}
📞 ဖုန်း: ${order.phone}
💰 ငွေပမာဏ: ${order.price.toLocaleString()} KS
📅 ရက်စွဲ: ${new Date(order.createdAt).toLocaleDateString('en-GB')}
📊 အခြေအနေ: ${statusEmoji}${extraInfo}
          `;
          
          const keyboard = {
            inline_keyboard: [
              [{ text: "✅ အတည်ပြုမည်", callback_data: `approve_${order.id}` }],
              [{ text: "❌ ပယ်ဖျက်မည်", callback_data: `reject_${order.id}` }],
              [{ text: "🔙 နောက်သို့", callback_data: "back_to_menu" }]
            ]
          };
          await sendTelegramMessage(chatId, detailMsg, keyboard);
        }
        return res.sendStatus(200);
      }
      
      // ========== VIEW PENDING ORDERS ==========
      if (data === 'view_pending') {
        const allOrders = db ? await getAllOrdersFromFirebase() : orders;
        const pendingOrdersList = allOrders.filter(o => o.status === 'payment_received');
        
        if (pendingOrdersList.length === 0) {
          await sendTelegramMessage(chatId, "📭 ဆိုင်းငံ့ထားသော အော်ဒါမရှိပါ။");
        } else {
          let msg = "📋 **ဆိုင်းငံ့ထားသော အော်ဒါများ**\n━━━━━━━━━━━━━━━━━━\n";
          const buttons = [];
          
          for (const order of pendingOrdersList.slice(0, 10)) {
            msg += `💰 *#${order.id}* | ${order.packageName}\n   📞 ${order.phone}\n   💰 ${order.price.toLocaleString()} KS\n\n`;
            buttons.push([{ text: `💰 အော်ဒါ #${order.id}`, callback_data: `detail_${order.id}` }]);
          }
          
          buttons.push([{ text: "🔙 ပင်မစာမျက်နှာ", callback_data: "back_to_menu" }]);
          await sendTelegramMessage(chatId, msg, { inline_keyboard: buttons });
        }
        return res.sendStatus(200);
      }
      
      // ========== VIEW ALL ORDERS ==========
      if (data === 'view_all') {
        const allOrders = db ? await getAllOrdersFromFirebase() : orders;
        if (allOrders.length === 0) {
          await sendTelegramMessage(chatId, "📭 အော်ဒါမရှိသေးပါ။");
        } else {
          let msg = "📋 **အော်ဒါအားလုံး**\n━━━━━━━━━━━━━━━━━━\n";
          const buttons = [];
          
          for (const order of allOrders.slice(0, 15)) {
            const statusEmoji = {
              'pending_payment': '⏳', 'payment_received': '💰', 'approved': '✅', 'rejected': '❌'
            }[order.status] || '📌';
            msg += `${statusEmoji} *#${order.id}* | ${order.packageName}\n   📞 ${order.phone}\n   💰 ${order.price.toLocaleString()} KS\n\n`;
            buttons.push([{ text: `${statusEmoji} အော်ဒါ #${order.id}`, callback_data: `detail_${order.id}` }]);
          }
          
          buttons.push([{ text: "🔙 ပင်မစာမျက်နှာ", callback_data: "back_to_menu" }]);
          await sendTelegramMessage(chatId, msg, { inline_keyboard: buttons });
        }
        return res.sendStatus(200);
      }
      
      // ========== PAYMENT INFO ==========
      if (data === 'payment_info') {
        const paymentMsg = `
💰 **ငွေလွှဲအချက်အလက်**

🏧 *KPay / WavePay:* \`09789999368\`
👤 *Name:* AUNG THU HTWE

📌 Customer အား ငွေလွှဲပြီးပါက Screenshot ပေးပို့ရန် ပြောပါ။
        `;
        const keyboard = {
          inline_keyboard: [[{ text: "🔙 ပင်မစာမျက်နှာ", callback_data: "back_to_menu" }]]
        };
        await sendTelegramMessage(chatId, paymentMsg, keyboard);
        return res.sendStatus(200);
      }
      
      // ========== HELP ==========
      if (data === 'help') {
        const helpMsg = `
🤖 *MYTEL ORDER BOT - အကူအညီ*

*ခလုတ်များ အသုံးပြုနည်း:*
• 📋 ငွေလွှဲပြီးအော်ဒါများ - အတည်ပြုရန်အသင့်အော်ဒါများ
• 📜 အော်ဒါအားလုံး - အော်ဒါမှတ်တမ်းအားလုံး
• 💰 ငွေလွှဲအချက်အလက် - Customer အတွက် ငွေလွှဲအကောင့်
• 🔄 စာရင်းအင်းအသစ် - လတ်တလောစာရင်းအင်းများ
        `;
        const keyboard = {
          inline_keyboard: [[{ text: "🔙 ပင်မစာမျက်နှာ", callback_data: "back_to_menu" }]]
        };
        await sendTelegramMessage(chatId, helpMsg, keyboard);
        return res.sendStatus(200);
      }
      
      // ========== REFRESH STATS ==========
      if (data === 'refresh_stats') {
        const stats = await getOrderStats();
        await sendTelegramMessage(chatId, `🔄 *စာရင်းအင်းအသစ်*\n\n${stats}`);
        return res.sendStatus(200);
      }
      
      // ========== BACK TO MENU ==========
      if (data === 'back_to_menu') {
        const stats = await getOrderStats();
        const menuMessage = `
🤖 *MYTEL ORDER BOT - ADMIN PANEL*

မင်္ဂလာပါ Admin! 👋

${stats}

🔽 *အောက်ပါခလုတ်များကို အသုံးပြုပါ:*
        `;
        const keyboard = {
          inline_keyboard: [
            [{ text: "📋 ငွေလွှဲပြီးအော်ဒါများ", callback_data: "view_pending" }, { text: "📜 အော်ဒါအားလုံး", callback_data: "view_all" }],
            [{ text: "💰 ငွေလွှဲအချက်အလက်", callback_data: "payment_info" }, { text: "❓ အကူအညီ", callback_data: "help" }],
            [{ text: "🔄 စာရင်းအင်းအသစ်", callback_data: "refresh_stats" }]
          ]
        };
        await sendTelegramMessage(chatId, menuMessage, keyboard);
        return res.sendStatus(200);
      }
      
      return res.sendStatus(200);
    }
    
    if (!message) return res.sendStatus(200);
    const chatId = message.chat.id;
    const text = message.text || "";
    
    if (chatId.toString() === ADMIN_CHAT_ID.toString() && text === '/start') {
      const stats = await getOrderStats();
      const menuMessage = `
🤖 *MYTEL ORDER BOT - ADMIN PANEL*

မင်္ဂလာပါ Admin! 👋

${stats}

🔽 *အောက်ပါခလုတ်များကို အသုံးပြုပါ:*
      `;
      const keyboard = {
        inline_keyboard: [
          [{ text: "📋 ငွေလွှဲပြီးအော်ဒါများ", callback_data: "view_pending" }, { text: "📜 အော်ဒါအားလုံး", callback_data: "view_all" }],
          [{ text: "💰 ငွေလွှဲအချက်အလက်", callback_data: "payment_info" }, { text: "❓ အကူအညီ", callback_data: "help" }],
          [{ text: "🔄 စာရင်းအင်းအသစ်", callback_data: "refresh_stats" }]
        ]
      };
      await sendTelegramMessage(chatId, menuMessage, keyboard);
      return res.sendStatus(200);
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook error:", error);
    res.sendStatus(200);
  }
});

// ========== TEST ENDPOINTS ==========
app.get('/test-bot', async (req, res) => {
  const stats = await getOrderStats();
  const menuMessage = `
🤖 *MYTEL ORDER BOT - ADMIN PANEL*

မင်္ဂလာပါ Admin! 👋

${stats}

🔽 *အောက်ပါခလုတ်များကို အသုံးပြုပါ:*
  `;
  const keyboard = {
    inline_keyboard: [
      [{ text: "📋 ငွေလွှဲပြီးအော်ဒါများ", callback_data: "view_pending" }, { text: "📜 အော်ဒါအားလုံး", callback_data: "view_all" }],
      [{ text: "💰 ငွေလွှဲအချက်အလက်", callback_data: "payment_info" }, { text: "❓ အကူအညီ", callback_data: "help" }],
      [{ text: "🔄 စာရင်းအင်းအသစ်", callback_data: "refresh_stats" }]
    ]
  };
  await sendTelegramMessage(ADMIN_CHAT_ID, menuMessage, keyboard);
  res.json({ success: true });
});

app.get('/orders-list', async (req, res) => {
  const allOrders = db ? await getAllOrdersFromFirebase() : orders;
  res.json({ orders: allOrders, count: allOrders.length });
});

// ========== ROOT ENDPOINT ==========
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== SET WEBHOOK ==========
async function setWebhook() {
  if (!BOT_TOKEN) return;
  const webhookUrl = `https://ath-digital-hub.onrender.com/webhook/${BOT_TOKEN}`;
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
    const result = await response.json();
    console.log("Webhook set:", result.ok ? "✅ Success" : "❌ Failed", result.description);
  } catch (error) {
    console.error("Webhook error:", error);
  }
}

// ========== SERVER START ==========
const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📨 BOT_TOKEN: ${BOT_TOKEN ? '✅ Set' : '❌ Missing'}`);
  console.log(`👤 ADMIN_CHAT_ID: ${ADMIN_CHAT_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`📢 ALARM_GROUP_ID: ${ALARM_GROUP_ID}`);
  console.log(`🔥 Firebase: ${db ? '✅ Connected' : '⚠️ Not connected (using memory)'}`);
  await setWebhook();
});
