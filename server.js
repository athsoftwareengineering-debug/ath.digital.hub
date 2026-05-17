const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const admin = require('firebase-admin');

const app = express();

// ========== FIREBASE ADMIN SDK INITIALIZATION ==========
let serviceAccount;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log('✅ Firebase service account loaded from environment');
  } else {
    // Local development fallback
    const localPath = path.join(__dirname, 'firebase-service-account.json');
    if (fs.existsSync(localPath)) {
      serviceAccount = require(localPath);
      console.log('✅ Firebase service account loaded from local file');
    }
  }
} catch (error) {
  console.error('❌ Firebase service account error:', error.message);
}

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('✅ Firebase Admin SDK initialized successfully');
} else {
  console.log('⚠️ Firebase not configured, using in-memory storage fallback');
}

const db = admin.firestore ? admin.firestore() : null;
const ordersCollection = db ? db.collection('orders') : null;

// ========== MYANMAR TIME ZONE ==========
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

function formatEnglishDate(date) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString('en-US', { 
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
app.use('/temp_uploads', express.static(path.join(__dirname, 'temp_uploads')));

// ========== ENVIRONMENT VARIABLES ==========
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.CHAT_ID;
const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "mytel2024";

console.log(`\n🔐 ========== SYSTEM STARTUP ==========`);
console.log(`🔑 Admin Password: ${ADMIN_PASSWORD}`);
console.log(`🕐 Myanmar Time: ${getMyanmarTime12hr().full}`);
console.log(`🔥 Firebase: ${ordersCollection ? '✅ CONNECTED' : '⚠️ FALLBACK (in-memory)'}`);
console.log(`======================================\n`);

// ========== FALLBACK STORAGE ==========
let memoryOrders = [];
let orderIdCounter = 1;

const PACKAGES = {
  "VIP LEVEL - 1": { price: 15000, desc: "22GB / 8000 Mins / 5000 SMS" },
  "VIP LEVEL - 2": { price: 20000, desc: "40GB / 250 Mins / 25 Any Net" },
  "VIP LEVEL - 3": { price: 25000, desc: "40GB / 1400 Mins / 8000 SMS" },
  "VIP LEVEL - 4 (ULTRA)": { price: 30000, desc: "120GB High-Speed Data" }
};

// ========== FIREBASE DATABASE FUNCTIONS ==========
async function getNextOrderId() {
  if (ordersCollection) {
    try {
      const snapshot = await ordersCollection.orderBy('id', 'desc').limit(1).get();
      if (!snapshot.empty) {
        return snapshot.docs[0].data().id + 1;
      }
      return 1;
    } catch (error) {
      console.error('Firebase getNextOrderId error:', error);
      return orderIdCounter++;
    }
  }
  return orderIdCounter++;
}

async function saveOrder(orderData) {
  if (ordersCollection) {
    try {
      await ordersCollection.doc(orderData.id.toString()).set(orderData);
      console.log(`✅ Order #${orderData.id} saved to Firebase`);
      return orderData;
    } catch (error) {
      console.error('Firebase save error:', error);
      memoryOrders.unshift(orderData);
      return orderData;
    }
  }
  memoryOrders.unshift(orderData);
  return orderData;
}

async function getOrder(orderId) {
  if (ordersCollection) {
    try {
      const doc = await ordersCollection.doc(orderId.toString()).get();
      if (doc.exists) {
        return { id: parseInt(doc.id), ...doc.data() };
      }
      return null;
    } catch (error) {
      console.error('Firebase get error:', error);
      return memoryOrders.find(o => o.id === parseInt(orderId));
    }
  }
  return memoryOrders.find(o => o.id === parseInt(orderId));
}

async function getAllOrders() {
  if (ordersCollection) {
    try {
      const snapshot = await ordersCollection.orderBy('createdAt', 'desc').get();
      const orders = snapshot.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() }));
      console.log(`📊 Retrieved ${orders.length} orders from Firebase`);
      return orders;
    } catch (error) {
      console.error('Firebase getAll error:', error);
      return [...memoryOrders];
    }
  }
  return [...memoryOrders];
}

async function updateOrder(orderId, updateData) {
  if (ordersCollection) {
    try {
      await ordersCollection.doc(orderId.toString()).update(updateData);
      console.log(`✅ Order #${orderId} updated in Firebase`);
      return await getOrder(orderId);
    } catch (error) {
      console.error('Firebase update error:', error);
      const order = memoryOrders.find(o => o.id === parseInt(orderId));
      if (order) {
        Object.assign(order, updateData);
        return order;
      }
      return null;
    }
  }
  const order = memoryOrders.find(o => o.id === parseInt(orderId));
  if (order) {
    Object.assign(order, updateData);
    return order;
  }
  return null;
}

// ========== FILE UPLOAD ==========
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'temp_uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const mt = getMyanmarTime12hr();
    cb(null, mt.timestamp + '-' + Math.round(Math.random() * 1E9) + '.jpg');
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
  return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
}

async function updateAllOrdersRemainingDays() {
  console.log('🔄 Running daily countdown check...');
  const orders = await getAllOrders();
  for (const order of orders) {
    if (order.status === 'approved' && order.endDate) {
      const remaining = calculateRemainingDays(order.endDate);
      await updateOrder(order.id, { daysRemaining: remaining });
      if (remaining <= 0 && !order.isExpired) {
        await updateOrder(order.id, { isExpired: true, status: 'expired' });
        await sendTelegramMessage(ADMIN_CHAT_ID, `⏰ EXPIRED: Order #${order.id}\n📞 ${order.phone}`);
      }
      const alertDays = [5, 3, 1];
      if (alertDays.includes(remaining) && order.lastAlertDay !== remaining && remaining > 0) {
        await updateOrder(order.id, { lastAlertDay: remaining });
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
  setTimeout(() => {
    updateAllOrdersRemainingDays();
    scheduleDailyTask();
  }, next9AM - now);
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

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, message: "Login successful" });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

app.post('/order', async (req, res) => {
  try {
    const { packageName, phone } = req.body;
    const mt = getMyanmarTime12hr();
    console.log(`📦 New order: ${packageName} for ${phone}`);
    
    const packageData = PACKAGES[packageName];
    if (!packageData) {
      return res.status(400).json({ success: false, message: "Invalid package" });
    }
    
    const newOrderId = await getNextOrderId();
    const newOrder = {
      id: newOrderId,
      packageName, phone,
      price: packageData.price,
      status: "pending_payment",
      createdAt: mt.iso,
      createdAtMyanmar: mt.full,
      updatedAt: mt.iso,
      startDate: null, endDate: null,
      daysRemaining: null, isExpired: false, lastAlertDay: null,
      screenshotPath: null
    };
    
    await saveOrder(newOrder);
    await sendTelegramMessage(ADMIN_CHAT_ID, `🆕 New Order #${newOrder.id}\n📦 ${packageName}\n📞 ${phone}\n💰 ${packageData.price.toLocaleString()} KS`);
    res.json({ success: true, orderId: newOrder.id });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post('/submit-payment', upload.single('screenshot'), async (req, res) => {
  let tempFilePath = null;
  try {
    const orderId = parseInt(req.body.orderId);
    const screenshot = req.file;
    const mt = getMyanmarTime12hr();
    
    if (!screenshot) return res.status(400).json({ success: false, message: "Screenshot required" });
    
    const order = await getOrder(orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    
    const screenshotPath = `/temp_uploads/${screenshot.filename}`;
    await updateOrder(orderId, {
      status: 'payment_received',
      updatedAt: mt.iso,
      screenshotPath: screenshotPath
    });
    
    tempFilePath = screenshot.path;
    const fileBuffer = fs.readFileSync(tempFilePath);
    const caption = `💰 Payment Received #${orderId}\n📦 ${order.packageName}\n📞 ${order.phone}\n💰 ${order.price.toLocaleString()} KS`;
    const keyboard = {
      inline_keyboard: [[{ text: "✅ Approve (30 Days)", callback_data: `approve_${orderId}` }, { text: "❌ Reject", callback_data: `reject_${orderId}` }]]
    };
    await sendTelegramPhoto(ADMIN_CHAT_ID, fileBuffer, caption, keyboard);
    res.json({ success: true, message: "Payment submitted!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
  }
});

app.get('/api/admin/order-screenshot', async (req, res) => {
  const authToken = req.headers['x-admin-auth'];
  if (authToken !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const orderId = parseInt(req.query.orderId);
  const order = await getOrder(orderId);
  if (order && order.screenshotPath) {
    res.json({ success: true, screenshotUrl: `https://ath-digital-hub.onrender.com${order.screenshotPath}` });
  } else {
    res.json({ success: false, message: "No screenshot available" });
  }
});

app.get('/api/track-order', async (req, res) => {
  const { orderId, phone } = req.query;
  const order = await getOrder(parseInt(orderId));
  if (!order || order.phone !== phone) {
    return res.json({ success: false, message: "Order not found" });
  }
  res.json({ success: true, order });
});

app.get('/api/admin/orders', async (req, res) => {
  const authToken = req.headers['x-admin-auth'];
  if (authToken !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const allOrdersList = await getAllOrders();
  const stats = {
    total: allOrdersList.length,
    pending: allOrdersList.filter(o => o.status === 'pending_payment').length,
    paid: allOrdersList.filter(o => o.status === 'payment_received').length,
    approved: allOrdersList.filter(o => o.status === 'approved').length,
    rejected: allOrdersList.filter(o => o.status === 'rejected').length,
    expired: allOrdersList.filter(o => o.status === 'expired').length,
    revenue: allOrdersList.filter(o => o.status === 'approved').reduce((sum, o) => sum + o.price, 0)
  };
  res.json({ success: true, orders: allOrdersList, stats });
});

app.post('/api/admin/update-order', async (req, res) => {
  const authToken = req.headers['x-admin-auth'];
  if (authToken !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const { orderId, status } = req.body;
  const order = await getOrder(parseInt(orderId));
  if (!order) return res.status(404).json({ success: false });
  
  const mt = getMyanmarTime12hr();
  if (status === 'approved' && !order.startDate) {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    await updateOrder(parseInt(orderId), {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      daysRemaining: 30,
      status: 'approved',
      updatedAt: mt.iso
    });
    await sendTelegramMessage(ADMIN_CHAT_ID, `✅ Order #${orderId} approved! 30 days started.`);
  } else {
    await updateOrder(parseInt(orderId), { status, updatedAt: mt.iso });
  }
  res.json({ success: true });
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
        const order = await getOrder(orderId);
        if (order && !order.startDate) {
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + 30);
          await updateOrder(orderId, {
            startDate: new Date().toISOString(),
            endDate: endDate.toISOString(),
            daysRemaining: 30,
            status: 'approved'
          });
          await sendTelegramMessage(chatId, `✅ Order #${orderId} approved!`);
        }
      }
      if (data.startsWith('reject_')) {
        const orderId = parseInt(data.split('_')[1]);
        await updateOrder(orderId, { status: 'rejected' });
        await sendTelegramMessage(chatId, `❌ Order #${orderId} rejected.`);
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
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📱 Customer: https://ath-digital-hub.onrender.com/`);
  console.log(`👑 Admin: https://ath-digital-hub.onrender.com/admin`);
  console.log(`🔥 Firebase: ${ordersCollection ? '✅ READY' : '⚠️ FALLBACK MODE'}\n`);
  
  if (BOT_TOKEN) {
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=https://ath-digital-hub.onrender.com/webhook/${BOT_TOKEN}`)
      .then(res => res.json())
      .then(result => console.log(`📡 Webhook: ${result.ok ? '✅' : '❌'}`));
  }
});
