require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const morgan = require('morgan');

const database = require('./database');
const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.disable('x-powered-by');
app.use(morgan('combined'));

process.env.TZ = 'Asia/Yangon';

function getMyanmarTime12hr() {
  const now = new Date();
  return {
    full: now.toLocaleString('en-US', { 
      timeZone: 'Asia/Yangon', hour12: true, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    }),
    iso: now.toISOString(),
    timestamp: now.getTime()
  };
}

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "mytel2024";
const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 10000}`;
const ADMIN_PATH = process.env.ADMIN_PATH || '/admin';
const ALLOWED_ADMIN_IPS = process.env.ALLOWED_ADMIN_IPS ? process.env.ALLOWED_ADMIN_IPS.split(',') : [];

console.log(`\n🔐 ========== SYSTEM STARTUP ==========`);
console.log(`🔑 Admin Password: ${ADMIN_PASSWORD}`);
console.log(`🌐 BASE_URL: ${BASE_URL}`);
console.log(`======================================\n`);

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
app.use(express.static(publicDir));

const uploadDir = path.join(__dirname, 'temp_uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/temp_uploads', express.static(uploadDir));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { success: false, message: "Too many requests." } });
const strictLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: { success: false, message: "Too many attempts." } });

app.use('/api/admin/login', strictLimiter);

const PACKAGES = {
  "VIP LEVEL - 1": { price: 15000 },
  "VIP LEVEL - 2": { price: 20000 },
  "VIP LEVEL - 3": { price: 25000 },
  "VIP LEVEL - 4": { price: 30000 }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + '.jpg')
});
const upload = multer({ 
  storage, limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') ? cb(null, true) : cb(new Error('Only JPEG/PNG allowed'), false)
});

function maskPhone(phone) {
  if (!phone) return phone;
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 7) return phone;
  return cleaned.slice(0, 4) + '*'.repeat(cleaned.length - 7) + cleaned.slice(-3);
}

async function sendTelegramMessage(chatId, text, keyboard = null) {
  if (!BOT_TOKEN || !chatId) return false;
  try {
    const body = { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true };
    if (keyboard) body.reply_markup = JSON.stringify(keyboard);
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    return (await res.json()).ok;
  } catch { return false; }
}

async function sendTelegramPhoto(chatId, buffer, caption, keyboard = null) {
  if (!BOT_TOKEN || !chatId) return false;
  try {
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('photo', buffer, { filename: 'screenshot.jpg' });
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');
    if (keyboard) formData.append('reply_markup', JSON.stringify(keyboard));
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, { method: 'POST', body: formData, headers: formData.getHeaders() });
    return (await res.json()).ok;
  } catch { return false; }
}

async function sendToGroupOrderApproved(order) {
  if (!GROUP_CHAT_ID) return false;
  const message = `✅ <b>အော်ဒါအတည်ပြုပြီးပါပြီ။</b> ✅\n━━━━━━━━━━━━━━━━━━━━\n🆔 အော်ဒါအမှတ်: <b>#${order.id}</b>\n📞 ဖုန်းနံပါတ်: <code>${maskPhone(order.phone)}</code>\n📦 Package: <b>${order.packageName}</b>\n💰 ပမာဏ: <b>${order.price.toLocaleString()} KS</b>\n━━━━━━━━━━━━━━━━━━━━\n✅ Status: <b>✅ ဒေတာသွင်းပြီးပါပြီ။</b>`;
  return await sendTelegramMessage(GROUP_CHAT_ID, message);
}

async function sendToGroupOrderRejected(order, reason) {
  if (!GROUP_CHAT_ID) return false;
  const message = `❌ <b>အော်ဒါပယ်ဖျက်ခြင်း</b> ❌\n━━━━━━━━━━━━━━━━━━━━\n🆔 အော်ဒါအမှတ်: <b>#${order.id}</b>\n📞 ဖုန်းနံပါတ်: <code>${maskPhone(order.phone)}</code>\n📦 Package: <b>${order.packageName}</b>\n📝 အကြောင်းရင်း: ${reason}\n━━━━━━━━━━━━━━━━━━━━\n❌ Status: <b>❌ ပယ်ဖျက်ထားပါသည်။</b>`;
  return await sendTelegramMessage(GROUP_CHAT_ID, message);
}

function isAuthenticated(req, res, next) {
  if (req.headers['x-admin-auth'] === ADMIN_PASSWORD) return next();
  res.status(401).json({ success: false, message: "Unauthorized" });
}

app.post('/api/admin/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) res.json({ success: true });
  else res.status(401).json({ success: false });
});

app.get('/api/admin/orders', isAuthenticated, async (req, res) => {
  res.json({ success: true, orders: await database.getAllOrders(), stats: await database.getStats() });
});

app.post('/api/admin/update-order', isAuthenticated, async (req, res) => {
  const { orderId, status, rejectReason } = req.body;
  try {
    const order = await database.getOrderById(parseInt(orderId));
    if (!order) return res.status(404).json({ success: false });

    if (status === 'approved' && !order.startDate) {
      const start = new Date(); const end = new Date(); end.setDate(end.getDate() + 30);
      await database.updateOrderStatus(parseInt(orderId), 'approved', start.toISOString(), end.toISOString(), 30);
      order.status = 'approved'; order.startDate = start.toISOString(); order.endDate = end.toISOString();
      await sendTelegramMessage(ADMIN_CHAT_ID, `✅ Order #${orderId} approved!`);
      await sendToGroupOrderApproved(order);
    } else if (status === 'rejected') {
      await database.updateOrderStatus(parseInt(orderId), 'rejected');
      await sendTelegramMessage(ADMIN_CHAT_ID, `❌ Order #${orderId} rejected.`);
      await sendToGroupOrderRejected(order, rejectReason || "ငွေလွှဲ မှန်ကန်မှုမရှိပါ။");
    } else {
      await database.updateOrderStatus(parseInt(orderId), status);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.post('/api/admin/delete-order', isAuthenticated, async (req, res) => {
  const { orderId } = req.body;
  try {
    const order = await database.getOrderById(parseInt(orderId));
    if (order && order.screenshotPath) {
      const fileName = path.basename(order.screenshotPath);
      const fullPath = path.join(__dirname, 'temp_uploads', fileName);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
    await database.deleteOrder(parseInt(orderId));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.post('/order', [
  body('packageName').isIn(Object.keys(PACKAGES)),
  body('phone').matches(/^(09|\+959)[0-9]{7,9}$/)
], async (req, res) => {
  if (!validationResult(req).isEmpty()) return res.status(400).json({ success: false, message: "Invalid Input" });
  try {
    const { packageName, phone, note } = req.body;
    const mt = getMyanmarTime12hr();
    const newOrder = { id: await database.getNextOrderId(), packageName, phone, price: PACKAGES[packageName].price, status: "pending_payment", createdAt: mt.iso, createdAtMyanmar: mt.full, updatedAt: mt.iso, note: note || '' };
    await database.createOrder(newOrder);
    await sendTelegramMessage(ADMIN_CHAT_ID, `🆕 New Order #${newOrder.id}\n📞 ${phone}\n📦 ${packageName}`);
    res.json({ success: true, orderId: newOrder.id });
  } catch { res.status(500).json({ success: false }); }
});

app.post('/submit-payment', upload.single('screenshot'), async (req, res) => {
  try {
    const orderId = parseInt(req.body.orderId);
    if (!req.file) return res.status(400).json({ success: false, message: "Screenshot required" });
    const order = await database.getOrderById(orderId);
    if (!order) return res.status(404).json({ success: false });

    const screenshotPath = `/temp_uploads/${req.file.filename}`;
    await database.updateOrderScreenshot(orderId, screenshotPath);
    await database.updateOrderStatus(orderId, 'payment_received');
    if (req.body.note) await database.updateOrderNote(orderId, req.body.note);

    const keyboard = { inline_keyboard: [[{ text: "✅ Approve", callback_data: `approve_${orderId}` }, { text: "❌ Reject", callback_data: `reject_${orderId}` }]] };
    await sendTelegramPhoto(ADMIN_CHAT_ID, fs.readFileSync(req.file.path), `💰 Payment Received #${orderId}\n📞 ${order.phone}`, keyboard);
    res.json({ success: true });
  } catch { res.status(500).json({ success: false }); }
});

app.get('/api/track-by-phone', async (req, res) => {
  try {
    const userOrders = await database.getOrdersByPhone(req.query.phone);
    res.json({ success: true, orders: userOrders });
  } catch { res.status(500).json({ success: false }); }
});

app.get('/api/admin/search', isAuthenticated, async (req, res) => {
  res.json({ success: true, orders: await database.searchOrders(req.query.q) });
});

app.get(ADMIN_PATH, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  database.startExpiryChecker(60);
});

module.exports = app;
