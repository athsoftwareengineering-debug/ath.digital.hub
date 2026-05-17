const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

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

// In-memory fallback storage
let ordersFallback = [];
let orderIdCounterFallback = 1;

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

// ========== FIREBASE INITIALIZATION ==========
let db = null;
let useFirebase = false;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({
      credential: cert(serviceAccount)
    });
    db = getFirestore();
    useFirebase = true;
    console.log("✅ Firebase initialized successfully");
  } else {
    console.log("⚠️ FIREBASE_SERVICE_ACCOUNT not found, using in-memory storage");
  }
} catch (error) {
  console.error("❌ Firebase init error:", error.message);
  console.log("⚠️ Falling back to in-memory storage");
}

// ========== HELPER FUNCTIONS ==========
function getMyanmarTime(date = new Date()) {
  const myanmarOffset = 6.5 * 60 * 60 * 1000;
  const myanmarTime = new Date(date.getTime() + myanmarOffset);
  const year = myanmarTime.getUTCFullYear();
  const month = String(myanmarTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(myanmarTime.getUTCDate()).padStart(2, '0');
  let hours = myanmarTime.getUTCHours();
  const minutes = String(myanmarTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(myanmarTime.getUTCSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${month}/${day}/${year} ${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
}

function getRemainingDays(expiredAt) {
  if (!expiredAt) return 0;
  const now = new Date();
  const expire = new Date(expiredAt);
  const diffTime = expire - now;
  if (diffTime <= 0) return 0;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ========== DATABASE OPERATIONS ==========
async function getNextOrderId() {
  if (useFirebase && db) {
    const counterRef = db.collection('counters').doc('orders');
    const counterDoc = await counterRef.get();
    let nextId = 1;
    if (counterDoc.exists) {
      nextId = counterDoc.data().nextId;
    }
    await counterRef.set({ nextId: nextId + 1 });
    return nextId;
  } else {
    return orderIdCounterFallback++;
  }
}

async function createOrder(orderData) {
  const orderId = await getNextOrderId();
  
  if (useFirebase && db) {
    const docRef = db.collection('orders').doc(orderId.toString());
    await docRef.set({
      ...orderData,
      id: orderId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return { id: orderId, ...orderData };
  } else {
    const newOrder = {
      id: orderId,
      ...orderData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    ordersFallback.unshift(newOrder);
    return newOrder;
  }
}

async function getOrder(orderId) {
  if (useFirebase && db) {
    const doc = await db.collection('orders').doc(orderId.toString()).get();
    if (doc.exists) {
      return { id: parseInt(doc.id), ...doc.data() };
    }
    return null;
  } else {
    return ordersFallback.find(o => o.id == orderId);
  }
}

async function updateOrderStatus(orderId, status, approvedAt = null) {
  const updateData = { status, updatedAt: new Date().toISOString() };
  if (status === 'approved' && approvedAt) {
    updateData.approvedAt = approvedAt;
    const expireDate = new Date(approvedAt);
    expireDate.setDate(expireDate.getDate() + 30);
    updateData.expiredAt = expireDate.toISOString();
    updateData.isActive = true;
  }
  
  if (useFirebase && db) {
    await db.collection('orders').doc(orderId.toString()).update(updateData);
    return true;
  } else {
    const order = ordersFallback.find(o => o.id == orderId);
    if (order) {
      Object.assign(order, updateData);
    }
    return order;
  }
}

async function getOrdersByPhone(phone) {
  if (useFirebase && db) {
    const snapshot = await db.collection('orders')
      .where('phone', '==', phone)
      .where('status', '==', 'approved')
      .get();
    return snapshot.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() }));
  } else {
    return ordersFallback.filter(o => o.phone === phone && o.status === 'approved');
  }
}

async function getAllOrders() {
  if (useFirebase && db) {
    const snapshot = await db.collection('orders').orderBy('createdAt', 'desc').limit(100).get();
    return snapshot.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() }));
  } else {
    return ordersFallback;
  }
}

async function getOrderStats() {
  let ordersList;
  if (useFirebase && db) {
    const snapshot = await db.collection('orders').get();
    ordersList = snapshot.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() }));
  } else {
    ordersList = ordersFallback;
  }
  
  const pending = ordersList.filter(o => o.status === 'pending_payment').length;
  const received = ordersList.filter(o => o.status === 'payment_received').length;
  const approved = ordersList.filter(o => o.status === 'approved' && o.isActive !== false).length;
  const expired = ordersList.filter(o => o.status === 'approved' && o.isActive === false).length;
  const rejected = ordersList.filter(o => o.status === 'rejected').length;
  const nearExpire = ordersList.filter(o => {
    if (o.status !== 'approved' || !o.isActive) return false;
    const daysLeft = getRemainingDays(o.expiredAt);
    return daysLeft > 0 && daysLeft <= 7;
  }).length;
  
  return {
    pending, received, approved, expired, rejected, nearExpire,
    text: `📊 *စာရင်းအင်း*
━━━━━━━━━━━━━━━━━━━━
⏳ ဆိုင်းငံ့: ${pending}
💰 ငွေလွှဲပြီး: ${received}
✅ အတည်ပြုပြီး: ${approved}
⚠️ ၇ ရက်အတွင်း Expire: ${nearExpire}
❌ Expired: ${expired}
🗑️ ပယ်ဖျက်ပြီး: ${rejected}`
  };
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
    console.log("Telegram send:", result.ok ? "✅" : "❌");
    return result.ok;
  } catch (error) {
    console.error("Telegram send error:", error);
    return false;
  }
}

async function sendTelegramPhoto(chatId, buffer, caption, keyboard = null) {
  if (!BOT_TOKEN) return false;
  try {
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
    return result.ok;
  } catch (error) {
    console.error("Telegram photo error:", error);
    return false;
  }
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
      packageName,
      phone,
      price: packageData.price,
      status: "pending_payment",
      isActive: false
    };
    
    const order = await createOrder(newOrder);
    
    console.log(`📦 Order #${order.id} created`);
    
    res.json({ 
      success: true, 
      orderId: order.id, 
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
    
    tempFilePath = screenshot.path;
    const fileBuffer = fs.readFileSync(tempFilePath);
    
    const order = await getOrder(orderId);
    const packageData = PACKAGES[order.packageName];
    
    const caption = `
🆕 **အော်ဒါအသစ် + ငွေလွှဲပြေစာ** #${orderId}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${order.packageName}
📞 ဖုန်း: ${order.phone}
💰 ငွေပမာဏ: ${packageData.price.toLocaleString()} KS
📝 မှတ်ချက်: ${note || "မရှိ"}
📅 အချိန်: ${getMyanmarTime()}
━━━━━━━━━━━━━━━━━━━━
⏳ **အတည်ပြုရန် အသင့်**
    `;
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: "✅ အတည်ပြုမည်", callback_data: `approve_${orderId}` },
          { text: "❌ ပယ်ဖျက်မည်", callback_data: `reject_${orderId}` }
        ],
        [
          { text: "📋 အသေးစိတ်", callback_data: `detail_${orderId}` }
        ]
      ]
    };
    
    const success = await sendTelegramPhoto(ADMIN_CHAT_ID, fileBuffer, caption, keyboard);
    
    if (success) {
      res.json({ success: true, message: "Order submitted! Admin will verify." });
    } else {
      res.json({ success: false, message: "Telegram error. Please try again." });
    }
    
  } catch (error) {
    console.error("Payment submit error:", error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
});

// ========== GET ORDER STATUS ==========
app.get('/order-status/:phone', async (req, res) => {
  const phone = req.params.phone;
  const userOrders = await getOrdersByPhone(phone);
  
  const result = userOrders.map(order => {
    const daysLeft = order.expiredAt ? getRemainingDays(order.expiredAt) : 0;
    const isExpired = daysLeft <= 0;
    
    return {
      id: order.id,
      packageName: order.packageName,
      price: order.price,
      approvedAt: order.approvedAt ? getMyanmarTime(new Date(order.approvedAt)) : null,
      expiredAt: order.expiredAt ? getMyanmarTime(new Date(order.expiredAt)) : null,
      daysLeft: daysLeft,
      isActive: !isExpired,
      status: isExpired ? 'expired' : 'active'
    };
  });
  
  res.json({ success: true, orders: result, count: result.length });
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
      
      // Approve Button
      if (data.startsWith('approve_')) {
        const orderId = parseInt(data.split('_')[1]);
        const order = await getOrder(orderId);
        
        if (order) {
          const approvedTime = new Date();
          await updateOrderStatus(orderId, 'approved', approvedTime);
          
          const expireDate = new Date(order.expiredAt);
          const daysUntilExpire = Math.ceil((expireDate - approvedTime) / (1000 * 60 * 60 * 24));
          
          const approveCaption = `
✅ **အတည်ပြုပြီး** - အော်ဒါ #${orderId}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${order.packageName}
📞 ဖုန်း: ${order.phone}
💰 ငွေပမာဏ: ${order.price.toLocaleString()} KS
📅 စတင်ရက်: ${getMyanmarTime(approvedTime)}
⏰ ကုန်ဆုံးရက်: ${getMyanmarTime(expireDate)}
⏳ အသုံးပြုနိုင်မည့်ရက်: ${daysUntilExpire} ရက်
━━━━━━━━━━━━━━━━━━━━
🎉 ဒေတာ သွင်းပေးပါမည်။
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
          
          await sendTelegramMessage(ADMIN_CHAT_ID, `✅ အော်ဒါ #${orderId} အတည်ပြုပြီး!\n📞 ${order.phone}`);
          
          if (GROUP_CHAT_ID) {
            await sendTelegramMessage(GROUP_CHAT_ID, `
🚨 **ဒေတာသွင်းပြီးပါပြီ** 🚨
━━━━━━━━━━━━━━━━━━━━
✅ အော်ဒါ #${orderId}
📞 ${order.phone}
📦 ${order.packageName}
💰 ${order.price.toLocaleString()} KS
            `);
          }
        }
        return res.sendStatus(200);
      }
      
      // Reject Button
      if (data.startsWith('reject_')) {
        const orderId = parseInt(data.split('_')[1]);
        const order = await getOrder(orderId);
        
        if (order) {
          await updateOrderStatus(orderId, 'rejected');
          
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
          
          await sendTelegramMessage(ADMIN_CHAT_ID, `❌ အော်ဒါ #${orderId} ပယ်ဖျက်ပြီး။`);
        }
        return res.sendStatus(200);
      }
      
      // Detail Button
      if (data.startsWith('detail_')) {
        const orderId = parseInt(data.split('_')[1]);
        const order = await getOrder(orderId);
        
        if (order) {
          let statusEmoji = '';
          let statusText = '';
          
          if (order.status === 'pending_payment') {
            statusEmoji = '⏳';
            statusText = 'ဆိုင်းငံ့';
          } else if (order.status === 'payment_received') {
            statusEmoji = '💰';
            statusText = 'ငွေလွှဲပြီး';
          } else if (order.status === 'approved') {
            statusEmoji = '✅';
            statusText = 'အတည်ပြုပြီး';
          } else if (order.status === 'rejected') {
            statusEmoji = '❌';
            statusText = 'ပယ်ဖျက်ပြီး';
          }
          
          const detailMsg = `
📋 **အော်ဒါအသေးစိတ်** #${order.id}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${order.packageName}
📞 ဖုန်း: ${order.phone}
💰 ငွေပမာဏ: ${order.price.toLocaleString()} KS
📊 အခြေအနေ: ${statusEmoji} ${statusText}
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
      
      // View Pending Orders
      if (data === 'view_pending') {
        const allOrders = await getAllOrders();
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
      
      // View All Orders
      if (data === 'view_all') {
        const allOrders = await getAllOrders();
        
        if (allOrders.length === 0) {
          await sendTelegramMessage(chatId, "📭 အော်ဒါမရှိသေးပါ။");
        } else {
          let msg = "📋 **အော်ဒါအားလုံး**\n━━━━━━━━━━━━━━━━━━\n";
          const buttons = [];
          
          for (const order of allOrders.slice(0, 15)) {
            let statusEmoji = '📌';
            if (order.status === 'pending_payment') statusEmoji = '⏳';
            else if (order.status === 'payment_received') statusEmoji = '💰';
            else if (order.status === 'approved') statusEmoji = '✅';
            else if (order.status === 'rejected') statusEmoji = '❌';
            
            msg += `${statusEmoji} *#${order.id}* | ${order.packageName}\n   📞 ${order.phone}\n   💰 ${order.price.toLocaleString()} KS\n\n`;
            buttons.push([{ text: `${statusEmoji} အော်ဒါ #${order.id}`, callback_data: `detail_${order.id}` }]);
          }
          
          buttons.push([{ text: "🔙 ပင်မစာမျက်နှာ", callback_data: "back_to_menu" }]);
          await sendTelegramMessage(chatId, msg, { inline_keyboard: buttons });
        }
        return res.sendStatus(200);
      }
      
      // Payment Info
      if (data === 'payment_info') {
        await sendTelegramMessage(chatId, `
💰 **ငွေလွှဲအချက်အလက်**

🏧 *KPay / WavePay:* \`09789999368\`
👤 *Name:* AUNG THU HTWE
        `);
        return res.sendStatus(200);
      }
      
      // Help
      if (data === 'help') {
        await sendTelegramMessage(chatId, `
🤖 *MYTEL ORDER BOT - အကူအညီ*

• 📋 ငွေလွှဲပြီးအော်ဒါများ
• 📜 အော်ဒါအားလုံး
• 💰 ငွေလွှဲအချက်အလက်
• 🔄 စာရင်းအင်းအသစ်
        `);
        return res.sendStatus(200);
      }
      
      // Refresh Stats
      if (data === 'refresh_stats') {
        const stats = await getOrderStats();
        await sendTelegramMessage(chatId, `🔄 *စာရင်းအင်းအသစ်*\n\n${stats.text}`);
        return res.sendStatus(200);
      }
      
      // Back to Menu
      if (data === 'back_to_menu') {
        const stats = await getOrderStats();
        const menuMessage = `
🤖 *MYTEL ORDER BOT - ADMIN PANEL*

မင်္ဂလာပါ Admin! 👋

${stats.text}

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
    
    // Handle /start command
    if (message && message.chat.id.toString() === ADMIN_CHAT_ID.toString() && message.text === '/start') {
      const stats = await getOrderStats();
      const menuMessage = `
🤖 *MYTEL ORDER BOT - ADMIN PANEL*

မင်္ဂလာပါ Admin! 👋

${stats.text}

🔽 *အောက်ပါခလုတ်များကို အသုံးပြုပါ:*
      `;
      const keyboard = {
        inline_keyboard: [
          [{ text: "📋 ငွေလွှဲပြီးအော်ဒါများ", callback_data: "view_pending" }, { text: "📜 အော်ဒါအားလုံး", callback_data: "view_all" }],
          [{ text: "💰 ငွေလွှဲအချက်အလက်", callback_data: "payment_info" }, { text: "❓ အကူအညီ", callback_data: "help" }],
          [{ text: "🔄 စာရင်းအင်းအသစ်", callback_data: "refresh_stats" }]
        ]
      };
      await sendTelegramMessage(message.chat.id, menuMessage, keyboard);
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

${stats.text}
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
  const allOrders = await getAllOrders();
  res.json({ orders: allOrders, count: allOrders.length });
});

app.get('/test-group', async (req, res) => {
  if (GROUP_CHAT_ID) {
    await sendTelegramMessage(GROUP_CHAT_ID, "🧪 Test message from bot");
    res.json({ success: true });
  } else {
    res.json({ success: false, error: "GROUP_CHAT_ID not set" });
  }
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
  console.log(`👥 GROUP_CHAT_ID: ${GROUP_CHAT_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`🔥 Firebase: ${useFirebase ? '✅ Connected' : '⚠️ Using fallback'}`);
  await setWebhook();
});
