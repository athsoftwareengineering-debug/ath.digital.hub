require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { initializeApp } = require('firebase/app');
const { getStorage, ref, uploadBytes, getDownloadURL } = require('firebase/storage');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const { fetch } = require('undici');
const FormData = require('form-data');

const app = express();

// ========== ENVIRONMENT VARIABLES ==========
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'ath_super_secret_change_me_in_production';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '104194@ath';
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID;

// ========== SECURITY MIDDLEWARE ==========
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// ========== FIREBASE ADMIN SDK (Firestore) ==========
let serviceAccount;
let db = null;
let ordersCollection = null;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    const localPath = path.join(__dirname, 'firebase-service-account.json');
    if (fs.existsSync(localPath)) serviceAccount = require(localPath);
  }
} catch (error) {
  console.error('Firebase service account error:', error.message);
}

if (serviceAccount && !admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  db = admin.firestore();
  ordersCollection = db.collection('orders');
  console.log('✅ Firestore connected');
} else if (admin.apps.length) {
  db = admin.firestore();
  ordersCollection = db.collection('orders');
} else {
  console.warn('⚠️ Firestore not configured, using in-memory fallback');
}

// ========== FIREBASE CLIENT SDK (Storage) ==========
const firebaseClientConfig = {
  apiKey: "AIzaSyCN7GMpY6dqGzVlMevMZPG76guq3DvQPd8",
  authDomain: "mytelordersystem.firebaseapp.com",
  projectId: "mytelordersystem",
  storageBucket: "mytelordersystem.firebasestorage.app",
};
const firebaseApp = initializeApp(firebaseClientConfig);
const storage = getStorage(firebaseApp);

// ========== IN-MEMORY FALLBACK ==========
let memoryOrders = [];
let orderIdCounter = 1;

// ========== MYANMAR TIME ZONE ==========
process.env.TZ = 'Asia/Yangon';
function getMyanmarTime() {
  const now = new Date();
  return {
    full: now.toLocaleString('en-US', { timeZone: 'Asia/Yangon', hour12: true }),
    iso: now.toISOString(),
    timestamp: now.getTime()
  };
}

// ========== JWT AUTH MIDDLEWARE ==========
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Access token required' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// ========== TELEGRAM FUNCTIONS ==========
async function sendTelegramMessage(chatId, text, keyboard = null) {
  if (!BOT_TOKEN || !chatId) return false;
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const body = { chat_id: chatId, text, parse_mode: 'Markdown' };
    if (keyboard) body.reply_markup = JSON.stringify(keyboard);
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await res.json();
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
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, { method: 'POST', body: formData });
    const result = await res.json();
    return result.ok;
  } catch (error) { return false; }
}

// ========== PACKAGES ==========
const PACKAGES = {
  "VIP LEVEL - 1": { price: 15000, desc: "22GB / 8000 Mins / 5000 SMS" },
  "VIP LEVEL - 2": { price: 20000, desc: "40GB / 250 Mins / 25 Any Net" },
  "VIP LEVEL - 3": { price: 25000, desc: "40GB / 1400 Mins / 8000 SMS" },
  "VIP LEVEL - 4": { price: 30000, desc: "120GB High-Speed Data" }
};

// ========== DATABASE HELPERS ==========
async function getNextOrderId() {
  if (ordersCollection) {
    const snapshot = await ordersCollection.orderBy('id', 'desc').limit(1).get();
    if (!snapshot.empty) return snapshot.docs[0].data().id + 1;
    return 1;
  }
  return orderIdCounter++;
}

async function saveOrder(orderData) {
  if (ordersCollection) {
    await ordersCollection.doc(orderData.id.toString()).set(orderData);
    return orderData;
  }
  memoryOrders.unshift(orderData);
  return orderData;
}

async function getOrder(orderId) {
  if (ordersCollection) {
    const doc = await ordersCollection.doc(orderId.toString()).get();
    if (doc.exists) return { id: parseInt(doc.id), ...doc.data() };
    return null;
  }
  return memoryOrders.find(o => o.id === parseInt(orderId));
}

async function getAllOrders() {
  if (ordersCollection) {
    const snapshot = await ordersCollection.orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() }));
  }
  return [...memoryOrders];
}

async function updateOrder(orderId, updateData) {
  if (ordersCollection) {
    await ordersCollection.doc(orderId.toString()).update(updateData);
    return getOrder(orderId);
  }
  const order = memoryOrders.find(o => o.id === parseInt(orderId));
  if (order) Object.assign(order, updateData);
  return order;
}

// ========== SCREENSHOT UPLOAD TO FIREBASE STORAGE ==========
const upload = multer({ storage: multer.memoryStorage() });
async function uploadScreenshotToStorage(fileBuffer, orderId) {
  const timestamp = Date.now();
  const fileName = `screenshots/order_${orderId}_${timestamp}.jpg`;
  const storageRef = ref(storage, fileName);
  await uploadBytes(storageRef, fileBuffer, { contentType: 'image/jpeg' });
  const downloadUrl = await getDownloadURL(storageRef);
  return downloadUrl;
}

// ========== API ENDPOINTS ==========

// Admin Login (JWT)
app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  const isValid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  if (isValid) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: 'Invalid password' });
  }
});

// Create Order (Customer)
app.post('/api/order', async (req, res) => {
  try {
    const { packageName, phone } = req.body;
    if (!packageName || !phone || !/^09\d{9}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Invalid phone number (must be 09xxxxxxxxx)' });
    }
    const packageData = PACKAGES[packageName];
    if (!packageData) return res.status(400).json({ success: false, message: 'Invalid package' });
    const newId = await getNextOrderId();
    const myanmarTime = getMyanmarTime();
    const newOrder = {
      id: newId,
      packageName,
      phone,
      price: packageData.price,
      status: 'pending_payment',
      createdAt: myanmarTime.iso,
      createdAtMyanmar: myanmarTime.full,
      updatedAt: myanmarTime.iso,
      startDate: null,
      endDate: null,
      daysRemaining: null,
      isExpired: false,
      screenshotUrl: null
    };
    await saveOrder(newOrder);
    await sendTelegramMessage(ADMIN_CHAT_ID, `🆕 New Order #${newId}\n📞 ${phone}\n📦 ${packageName}\n💰 ${packageData.price} KS`);
    res.json({ success: true, orderId: newId, price: packageData.price });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Submit Payment with Screenshot (Customer)
app.post('/api/submit-payment', upload.single('screenshot'), async (req, res) => {
  try {
    const { orderId, packageName, phone, note } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: 'Screenshot required' });
    if (!/^09\d{9}$/.test(phone)) return res.status(400).json({ success: false, message: 'Invalid phone number' });
    const order = await getOrder(parseInt(orderId));
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.phone !== phone) return res.status(403).json({ success: false, message: 'Phone number does not match order' });

    const screenshotUrl = await uploadScreenshotToStorage(file.buffer, orderId);
    await updateOrder(orderId, { status: 'payment_received', screenshotUrl, updatedAt: getMyanmarTime().iso });

    const caption = `💰 Payment Received #${orderId}\n📦 ${order.packageName}\n📞 ${order.phone}\n💰 ${order.price} KS\n📝 Note: ${note || '-'}`;
    const keyboard = {
      inline_keyboard: [[
        { text: "✅ Approve", callback_data: `approve_${orderId}` },
        { text: "❌ Reject", callback_data: `reject_${orderId}` }
      ]]
    };
    const imgRes = await fetch(screenshotUrl);
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    await sendTelegramPhoto(ADMIN_CHAT_ID, imgBuffer, caption, keyboard);

    res.json({ success: true, message: 'Payment submitted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Track Order (Customer)
app.get('/api/track-order', async (req, res) => {
  const { phone } = req.query;
  if (!phone || !/^09\d{9}$/.test(phone)) {
    return res.status(400).json({ success: false, message: 'Valid phone number required' });
  }
  let orders = [];
  if (ordersCollection) {
    const snapshot = await ordersCollection.where('phone', '==', phone).orderBy('createdAt', 'desc').get();
    orders = snapshot.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() }));
  } else {
    orders = memoryOrders.filter(o => o.phone === phone);
  }
  const safeOrders = orders.map(o => ({
    id: o.id,
    packageName: o.packageName,
    phone: o.phone,
    price: o.price,
    status: o.status,
    createdAt: o.createdAt,
    startDate: o.startDate,
    endDate: o.endDate,
    daysRemaining: o.daysRemaining
  }));
  res.json({ success: true, orders: safeOrders });
});

// Admin: Get all orders (with JWT)
app.get('/api/admin/orders', authenticateToken, async (req, res) => {
  let allOrders = await getAllOrders();
  const stats = {
    total: allOrders.length,
    pending: allOrders.filter(o => o.status === 'pending_payment').length,
    paid: allOrders.filter(o => o.status === 'payment_received').length,
    approved: allOrders.filter(o => o.status === 'approved').length,
    rejected: allOrders.filter(o => o.status === 'rejected').length,
    expired: allOrders.filter(o => o.status === 'expired').length,
    revenue: allOrders.filter(o => o.status === 'approved').reduce((s, o) => s + o.price, 0)
  };
  res.json({ success: true, orders: allOrders, stats });
});

// Admin: Get screenshot URL (protected)
app.get('/api/admin/screenshot/:orderId', authenticateToken, async (req, res) => {
  const order = await getOrder(parseInt(req.params.orderId));
  if (!order || !order.screenshotUrl) return res.status(404).json({ success: false, message: 'No screenshot' });
  res.json({ success: true, screenshotUrl: order.screenshotUrl });
});

// Admin: Update single order
app.post('/api/admin/update-order', authenticateToken, async (req, res) => {
  const { orderId, status } = req.body;
  const order = await getOrder(parseInt(orderId));
  if (!order) return res.status(404).json({ success: false });
  const myanmarTime = getMyanmarTime();
  if (status === 'approved' && !order.startDate) {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    await updateOrder(orderId, {
      status: 'approved',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      daysRemaining: 30,
      updatedAt: myanmarTime.iso
    });
    if (GROUP_CHAT_ID) {
      await sendTelegramMessage(GROUP_CHAT_ID, `✅ MYTEL DATA ACTIVATED\nOrder #${order.id}\n📞 ${order.phone}\n📦 ${order.packageName}\n📅 Expires: ${endDate.toLocaleDateString()}`);
    }
  } else {
    await updateOrder(orderId, { status, updatedAt: myanmarTime.iso });
  }
  res.json({ success: true });
});

// Admin: Bulk update
app.post('/api/admin/bulk-update', authenticateToken, async (req, res) => {
  const { orderIds, status } = req.body;
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return res.status(400).json({ success: false, message: 'No orders selected' });
  }
  const myanmarTime = getMyanmarTime();
  if (ordersCollection) {
    const batch = db.batch();
    for (const id of orderIds) {
      const ref = ordersCollection.doc(id.toString());
      if (status === 'approved') {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);
        batch.update(ref, { status, startDate: startDate.toISOString(), endDate: endDate.toISOString(), daysRemaining: 30, updatedAt: myanmarTime.iso });
      } else {
        batch.update(ref, { status, updatedAt: myanmarTime.iso });
      }
    }
    await batch.commit();
  } else {
    for (const id of orderIds) {
      await updateOrder(id, { status, updatedAt: myanmarTime.iso });
    }
  }
  res.json({ success: true, message: `${orderIds.length} orders updated` });
});

// Telegram webhook
app.post(`/webhook/${BOT_TOKEN}`, async (req, res) => {
  try {
    const { callback_query } = req.body;
    if (callback_query && callback_query.data) {
      const data = callback_query.data;
      const chatId = callback_query.message.chat.id;
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callback_query.id })
      });
      if (data.startsWith('approve_')) {
        const orderId = parseInt(data.split('_')[1]);
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);
        await updateOrder(orderId, { status: 'approved', startDate: startDate.toISOString(), endDate: endDate.toISOString(), daysRemaining: 30 });
        await sendTelegramMessage(chatId, `✅ Order #${orderId} approved.`);
        if (GROUP_CHAT_ID) {
          const order = await getOrder(orderId);
          await sendTelegramMessage(GROUP_CHAT_ID, `✅ MYTEL DATA ACTIVATED\nOrder #${order.id}\n📞 ${order.phone}\n📦 ${order.packageName}`);
        }
      } else if (data.startsWith('reject_')) {
        const orderId = parseInt(data.split('_')[1]);
        await updateOrder(orderId, { status: 'rejected' });
        await sendTelegramMessage(chatId, `❌ Order #${orderId} rejected.`);
      }
    }
    res.sendStatus(200);
  } catch (err) { 
    console.error(err);
    res.sendStatus(200); 
  }
});

// Serve static pages
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  if (BOT_TOKEN) {
    const webhookUrl = `https://ath-digital-hub.onrender.com/webhook/${BOT_TOKEN}`;
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}`).catch(console.error);
  }
});

module.exports = app;
