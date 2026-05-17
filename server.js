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
let pendingRejectReasons = {};

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
    console.log("✅ Firebase initialized");
    
    setTimeout(async () => {
      await sendTelegramMessage(ADMIN_CHAT_ID, `
✅ *Firebase ချိတ်ဆက်မှု အောင်မြင်ပါသည်*
🔥 Database: Firebase (Cloud)
💾 Data Persistence: ✅ Yes
📅 အချိန်: ${getMyanmarTime()}
      `);
    }, 2000);
  } else {
    console.log("⚠️ Using in-memory storage");
    setTimeout(async () => {
      await sendTelegramMessage(ADMIN_CHAT_ID, `
⚠️ *Firebase မချိတ်ဆက်ပါ*
📁 Database: In-Memory
💾 Server Restart ချိန်တွင် Data ပျက်နိုင်
      `);
    }, 2000);
  }
} catch (error) {
  console.error("❌ Firebase init error:", error.message);
}

// ========== HELPER FUNCTIONS ==========
function getMyanmarTime(date = new Date()) {
  try {
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
  } catch (error) {
    return date.toLocaleString();
  }
}

function getRemainingDays(expiredAt) {
  if (!expiredAt) return 0;
  try {
    const now = new Date();
    const expire = new Date(expiredAt);
    const diffTime = expire - now;
    if (diffTime <= 0) return 0;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch (error) {
    return 0;
  }
}

// ========== DATABASE OPERATIONS ==========
async function getNextOrderId() {
  try {
    if (useFirebase && db) {
      const counterRef = db.collection('counters').doc('orders');
      const counterDoc = await counterRef.get();
      let nextId = 1;
      if (counterDoc.exists) nextId = counterDoc.data().nextId;
      await counterRef.set({ nextId: nextId + 1 });
      return nextId;
    } else {
      return orderIdCounterFallback++;
    }
  } catch (error) {
    return orderIdCounterFallback++;
  }
}

async function createOrder(orderData) {
  try {
    const orderId = await getNextOrderId();
    
    if (useFirebase && db) {
      await db.collection('orders').doc(orderId.toString()).set({
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
  } catch (error) {
    const newOrder = {
      id: orderIdCounterFallback++,
      ...orderData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    ordersFallback.unshift(newOrder);
    return newOrder;
  }
}

async function getOrder(orderId) {
  try {
    if (useFirebase && db) {
      const doc = await db.collection('orders').doc(orderId.toString()).get();
      if (doc.exists) return { id: parseInt(doc.id), ...doc.data() };
      return null;
    } else {
      return ordersFallback.find(o => o.id == orderId);
    }
  } catch (error) {
    return ordersFallback.find(o => o.id == orderId);
  }
}

async function updateOrderStatus(orderId, status, approvedAt = null, rejectReason = null) {
  try {
    const updateData = { status, updatedAt: new Date().toISOString() };
    
    if (status === 'approved' && approvedAt) {
      updateData.approvedAt = approvedAt.toISOString();
      const expireDate = new Date(approvedAt);
      expireDate.setDate(expireDate.getDate() + 30);
      updateData.expiredAt = expireDate.toISOString();
      updateData.isActive = true;
    }
    if (status === 'rejected' && rejectReason) {
      updateData.rejectReason = rejectReason;
      updateData.isActive = false;
    }
    
    if (useFirebase && db) {
      await db.collection('orders').doc(orderId.toString()).update(updateData);
      return true;
    } else {
      const order = ordersFallback.find(o => o.id == orderId);
      if (order) Object.assign(order, updateData);
      return order;
    }
  } catch (error) {
    const order = ordersFallback.find(o => o.id == orderId);
    if (order) order.status = status;
    return order;
  }
}

async function getAllOrders() {
  try {
    if (useFirebase && db) {
      const snapshot = await db.collection('orders').orderBy('createdAt', 'desc').limit(100).get();
      return snapshot.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() }));
    } else {
      return ordersFallback;
    }
  } catch (error) {
    return ordersFallback;
  }
}

async function getOrdersByPhone(phone) {
  try {
    if (useFirebase && db) {
      const snapshot = await db.collection('orders')
        .where('phone', '==', phone)
        .where('status', '==', 'approved')
        .get();
      return snapshot.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() }));
    } else {
      return ordersFallback.filter(o => o.phone === phone && o.status === 'approved');
    }
  } catch (error) {
    return ordersFallback.filter(o => o.phone === phone && o.status === 'approved');
  }
}

async function getOrderStats() {
  try {
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
  } catch (error) {
    return {
      pending: 0, received: 0, approved: 0, expired: 0, rejected: 0, nearExpire: 0,
      text: "📊 *စာရင်းအင်း*\n━━━━━━━━━━━━━━━━━━━━\n⏳ ဆိုင်းငံ့: 0\n💰 ငွေလွှဲပြီး: 0\n✅ အတည်ပြုပြီး: 0\n❌ Expired: 0\n🗑️ ပယ်ဖျက်ပြီး: 0"
    };
  }
}

// ========== SEND TELEGRAM MESSAGE ==========
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

// ========== WEBSITE ENDPOINTS ==========
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
    
    const order = await createOrder({
      packageName, phone, price: packageData.price,
      status: "pending_payment", isActive: false
    });
    
    res.json({ success: true, orderId: order.id, packageName, price: packageData.price, phone, paymentInfo: PAYMENT_INFO });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post('/submit-payment', upload.single('screenshot'), async (req, res) => {
  let tempFilePath = null;
  try {
    const orderId = parseInt(req.body.orderId);
    const packageName = req.body.packageName;
    const phone = req.body.phone;
    const note = req.body.note;
    const screenshot = req.file;
    
    if (!screenshot) return res.status(400).json({ success: false, message: "Screenshot required" });
    if (!orderId) return res.status(400).json({ success: false, message: "Order ID required" });
    
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
      inline_keyboard: [[
        { text: "✅ အတည်ပြုမည်", callback_data: `approve_${orderId}` },
        { text: "❌ ပယ်ဖျက်မည်", callback_data: `reject_${orderId}` }
      ], [
        { text: "📋 အသေးစိတ်", callback_data: `detail_${orderId}` }
      ]]
    };
    
    await sendTelegramPhoto(ADMIN_CHAT_ID, fileBuffer, caption, keyboard);
    res.json({ success: true, message: "Order submitted! Admin will verify." });
    
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
  }
});

app.get('/firebase-status', (req, res) => {
  res.json({ success: true, firebaseConnected: useFirebase });
});

app.get('/api/orders/:phone', async (req, res) => {
  try {
    const phone = req.params.phone;
    const orders = await getOrdersByPhone(phone);
    
    const result = orders.map(order => {
      const daysLeft = order.expiredAt ? getRemainingDays(order.expiredAt) : 0;
      const isExpired = daysLeft <= 0;
      
      let approvedAt = null;
      let expiredAt = null;
      
      if (order.approvedAt) {
        try {
          approvedAt = getMyanmarTime(new Date(order.approvedAt));
        } catch(e) { approvedAt = null; }
      }
      if (order.expiredAt) {
        try {
          expiredAt = getMyanmarTime(new Date(order.expiredAt));
        } catch(e) { expiredAt = null; }
      }
      
      return {
        id: order.id,
        packageName: order.packageName,
        price: order.price,
        approvedAt: approvedAt,
        expiredAt: expiredAt,
        daysLeft: daysLeft,
        isActive: !isExpired
      };
    });
    
    res.json({ success: true, orders: result, count: result.length });
  } catch (error) {
    res.json({ success: true, orders: [], count: 0 });
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
      
      // Approve Button
      if (data.startsWith('approve_')) {
        const orderId = parseInt(data.split('_')[1]);
        const order = await getOrder(orderId);
        
        if (order) {
          const approvedTime = new Date();
          await updateOrderStatus(orderId, 'approved', approvedTime);
          
          const expireDate = new Date(approvedTime);
          expireDate.setDate(expireDate.getDate() + 30);
          
          const approveCaption = `
✅ **အတည်ပြုပြီး** - အော်ဒါ #${orderId}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${order.packageName}
📞 ဖုန်း: ${order.phone}
💰 ငွေပမာဏ: ${order.price.toLocaleString()} KS
📅 စတင်ရက်: ${getMyanmarTime(approvedTime)}
📅 ကုန်ဆုံးရက်: ${getMyanmarTime(expireDate)}
━━━━━━━━━━━━━━━━━━━━
🎉 ဒေတာ သွင်းပေးပါမည်။
          `;
          
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageCaption`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId, message_id: messageId,
              caption: approveCaption, parse_mode: 'Markdown'
            })
          });
          
          await sendTelegramMessage(ADMIN_CHAT_ID, `✅ အော်ဒါ #${orderId} အတည်ပြုပြီး`);
          
          if (GROUP_CHAT_ID) {
            await sendTelegramMessage(GROUP_CHAT_ID, `
🚨 **ဒေတာသွင်းပြီးပါပြီ** 🚨
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
          pendingRejectReasons[chatId] = { orderId };
          
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: `❌ အော်ဒါ #${orderId} ပယ်ဖျက်ရသည့် အကြောင်းရင်းကို ရေးပါ။`,
              reply_markup: { force_reply: true, input_field_placeholder: "အကြောင်းရင်းရေးပါ..." }
            })
          });
        }
        return res.sendStatus(200);
      }
      
      // Detail Button
      if (data.startsWith('detail_')) {
        const orderId = parseInt(data.split('_')[1]);
        const order = await getOrder(orderId);
        
        if (order) {
          let statusText = '';
          if (order.status === 'pending_payment') statusText = '⏳ ဆိုင်းငံ့';
          else if (order.status === 'payment_received') statusText = '💰 ငွေလွှဲပြီး';
          else if (order.status === 'approved') statusText = '✅ အတည်ပြုပြီး';
          else if (order.status === 'rejected') statusText = '❌ ပယ်ဖျက်ပြီး';
          
          const detailMsg = `
📋 **အော်ဒါအသေးစိတ်** #${order.id}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${order.packageName}
📞 ဖုန်း: ${order.phone}
💰 ငွေပမာဏ: ${order.price.toLocaleString()} KS
📊 အခြေအနေ: ${statusText}
          `;
          
          const keyboard = {
            inline_keyboard: [[
              { text: "✅ အတည်ပြုမည်", callback_data: `approve_${order.id}` },
              { text: "❌ ပယ်ဖျက်မည်", callback_data: `reject_${order.id}` }
            ], [
              { text: "🔙 နောက်သို့", callback_data: "back_to_menu" }
            ]]
          };
          
          await sendTelegramMessage(chatId, detailMsg, keyboard);
        }
        return res.sendStatus(200);
      }
      
      // View Pending Orders
      if (data === 'view_pending') {
        const allOrders = await getAllOrders();
        const pendingList = allOrders.filter(o => o.status === 'payment_received');
        
        if (pendingList.length === 0) {
          await sendTelegramMessage(chatId, "📭 ဆိုင်းငံ့ထားသော အော်ဒါမရှိပါ။");
        } else {
          let msg = "📋 **ဆိုင်းငံ့ထားသော အော်ဒါများ**\n━━━━━━━━━━━━━━━━━━\n";
          const buttons = [];
          for (const order of pendingList.slice(0, 10)) {
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
            let emoji = '📌';
            if (order.status === 'pending_payment') emoji = '⏳';
            else if (order.status === 'payment_received') emoji = '💰';
            else if (order.status === 'approved') emoji = '✅';
            else if (order.status === 'rejected') emoji = '❌';
            
            msg += `${emoji} *#${order.id}* | ${order.packageName}\n   📞 ${order.phone}\n   💰 ${order.price.toLocaleString()} KS\n\n`;
            buttons.push([{ text: `${emoji} အော်ဒါ #${order.id}`, callback_data: `detail_${order.id}` }]);
          }
          buttons.push([{ text: "🔙 ပင်မစာမျက်နှာ", callback_data: "back_to_menu" }]);
          await sendTelegramMessage(chatId, msg, { inline_keyboard: buttons });
        }
        return res.sendStatus(200);
      }
      
      // Near Expire Orders
      if (data === 'near_expire') {
        const allOrders = await getAllOrders();
        const nearExpire = allOrders.filter(o => {
          if (o.status !== 'approved' || !o.isActive) return false;
          const days = getRemainingDays(o.expiredAt);
          return days > 0 && days <= 7;
        });
        
        if (nearExpire.length === 0) {
          await sendTelegramMessage(chatId, "📭 ၇ ရက်အတွင်း သက်တမ်းကုန်မည့် အော်ဒါမရှိပါ။");
        } else {
          let msg = "⚠️ **၇ ရက်အတွင်း သက်တမ်းကုန်မည့် အော်ဒါများ**\n━━━━━━━━━━━━━━━━━━\n";
          for (const order of nearExpire) {
            const days = getRemainingDays(order.expiredAt);
            msg += `🔴 *#${order.id}* | ${order.packageName}\n   📞 ${order.phone}\n   ⏳ ကျန်: ${days} ရက်\n\n`;
          }
          await sendTelegramMessage(chatId, msg);
        }
        return res.sendStatus(200);
      }
      
      // Payment Info
      if (data === 'payment_info') {
        await sendTelegramMessage(chatId, `
💰 **ငွေလွှဲအချက်အလက်**

🏧 KPay / WavePay: \`09789999368\`
👤 Name: AUNG THU HTWE
        `);
        return res.sendStatus(200);
      }
      
      // Help
      if (data === 'help') {
        await sendTelegramMessage(chatId, `
🤖 *MYTEL ORDER BOT - အကူအညီ*

• 📋 ငွေလွှဲပြီးအော်ဒါများ
• 📜 အော်ဒါအားလုံး
• ⚠️ သက်တမ်းကုန်ခါနီး
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

${stats.text}

🔽 *အောက်ပါခလုတ်များကို အသုံးပြုပါ:*
        `;
        const keyboard = {
          inline_keyboard: [
            [{ text: "📋 ငွေလွှဲပြီးအော်ဒါများ", callback_data: "view_pending" }, { text: "📜 အော်ဒါအားလုံး", callback_data: "view_all" }],
            [{ text: "⚠️ သက်တမ်းကုန်ခါနီး", callback_data: "near_expire" }, { text: "💰 ငွေလွှဲအချက်အလက်", callback_data: "payment_info" }],
            [{ text: "❓ အကူအညီ", callback_data: "help" }, { text: "🔄 စာရင်းအင်းအသစ်", callback_data: "refresh_stats" }]
          ]
        };
        await sendTelegramMessage(chatId, menuMessage, keyboard);
        return res.sendStatus(200);
      }
      
      return res.sendStatus(200);
    }
    
    // Handle text messages (reject reasons)
    if (message && pendingRejectReasons[message.chat.id]) {
      const chatId = message.chat.id;
      const { orderId } = pendingRejectReasons[chatId];
      const reason = message.text;
      const order = await getOrder(orderId);
      
      if (order && reason && !reason.startsWith('/')) {
        await updateOrderStatus(orderId, 'rejected', null, reason);
        
        const rejectMsg = `
❌ **ပယ်ဖျက်ပြီး** - အော်ဒါ #${orderId}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${order.packageName}
📞 ဖုန်း: ${order.phone}
💰 ငွေပမာဏ: ${order.price.toLocaleString()} KS
📝 အကြောင်း: ${reason}
        `;
        
        await sendTelegramMessage(ADMIN_CHAT_ID, rejectMsg);
        
        if (GROUP_CHAT_ID) {
          await sendTelegramMessage(GROUP_CHAT_ID, `
⚠️ **အော်ဒါပယ်ဖျက်ခြင်း**
❌ အော်ဒါ #${orderId}
📞 ${order.phone}
📦 ${order.packageName}
📝 အကြောင်း: ${reason}
          `);
        }
        
        await sendTelegramMessage(chatId, `✅ အော်ဒါ #${orderId} အား "${reason}" ဖြင့် ပယ်ဖျက်ပြီးပါပြီ။`);
      }
      
      delete pendingRejectReasons[chatId];
      return res.sendStatus(200);
    }
    
    // /start command
    if (message && message.chat.id.toString() === ADMIN_CHAT_ID.toString() && message.text === '/start') {
      const stats = await getOrderStats();
      const menuMessage = `
🤖 *MYTEL ORDER BOT - ADMIN PANEL*

${stats.text}

🔽 *အောက်ပါခလုတ်များကို အသုံးပြုပါ:*
      `;
      const keyboard = {
        inline_keyboard: [
          [{ text: "📋 ငွေလွှဲပြီးအော်ဒါများ", callback_data: "view_pending" }, { text: "📜 အော်ဒါအားလုံး", callback_data: "view_all" }],
          [{ text: "⚠️ သက်တမ်းကုန်ခါနီး", callback_data: "near_expire" }, { text: "💰 ငွေလွှဲအချက်အလက်", callback_data: "payment_info" }],
          [{ text: "❓ အကူအညီ", callback_data: "help" }, { text: "🔄 စာရင်းအင်းအသစ်", callback_data: "refresh_stats" }]
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
  const menuMessage = `🤖 *MYTEL ORDER BOT*\n\n${stats.text}`;
  const keyboard = {
    inline_keyboard: [
      [{ text: "📋 ငွေလွှဲပြီးအော်ဒါများ", callback_data: "view_pending" }, { text: "📜 အော်ဒါအားလုံး", callback_data: "view_all" }],
      [{ text: "⚠️ သက်တမ်းကုန်ခါနီး", callback_data: "near_expire" }, { text: "💰 ငွေလွှဲအချက်အလက်", callback_data: "payment_info" }],
      [{ text: "❓ အကူအညီ", callback_data: "help" }, { text: "🔄 စာရင်းအင်းအသစ်", callback_data: "refresh_stats" }]
    ]
  };
  await sendTelegramMessage(ADMIN_CHAT_ID, menuMessage, keyboard);
  res.json({ success: true });
});

app.get('/orders-list', async (req, res) => {
  const orders = await getAllOrders();
  res.json({ orders, count: orders.length });
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
    console.log("Webhook set:", result.ok ? "✅ Success" : "❌ Failed");
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
  console.log(`🔥 Firebase: ${useFirebase ? '✅ Connected' : '⚠️ Fallback'}`);
  await setWebhook();
});
