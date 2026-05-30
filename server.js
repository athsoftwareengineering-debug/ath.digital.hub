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

// Security
app.use(helmet({ contentSecurityPolicy: false }));
app.disable('x-powered-by');
app.use(morgan('combined'));

// Timezone helper
function getMyanmarTime12hr() {
  const now = new Date();
  return {
    full: now.toLocaleString('en-US', { timeZone: 'Asia/Yangon', hour12: true }),
    iso: now.toISOString()
  };
}

// Config
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const BASE_URL = process.env.BASE_URL;
const ADMIN_PATH = process.env.ADMIN_PATH || '/admin';

// Middleware
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Static folders
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
app.use(express.static(publicDir));

const uploadDir = path.join(__dirname, 'temp_uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/temp_uploads', express.static(uploadDir));

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + '.jpg')
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Packages
const PACKAGES = {
  "VIP 1": { price: 15000, data: "22GB", mins: "8000 Mins", sms: "5000 SMS" },
  "VIP 2": { price: 20000, data: "40GB", mins: "250 Mins", sms: "25 Any Net" },
  "VIP 3": { price: 25000, data: "40GB", mins: "1400 Mins", sms: "8000 SMS" },
  "VIP 4": { price: 30000, data: "120GB", mins: "Priority", sms: "5G+ Ultra" }
};

// Telegram helpers
async function sendTelegramMessage(chatId, text, keyboard = null) {
  if (!BOT_TOKEN || !chatId) return false;
  try {
    const body = { chat_id: chatId, text, parse_mode: 'HTML' };
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
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST', body: formData, headers: formData.getHeaders()
    });
    return (await res.json()).ok;
  } catch { return false; }
}

// ============ ADMIN API (Simple Token Auth) ============
function verifyAdmin(req, res, next) {
  const token = req.headers['x-admin-auth'];
  if (!token || token !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
}
// Set a simple admin secret for demo
process.env.ADMIN_SECRET = 'admin123';

app.get('/api/admin/orders', verifyAdmin, async (req, res) => {
  const orders = await database.getAllOrders();
  const stats = await database.getStats();
  res.json({ success: true, orders, stats });
});

app.post('/api/admin/update-order', verifyAdmin, async (req, res) => {
  const { orderId, status, rejectReason } = req.body;
  const order = await database.getOrderById(orderId);
  if (!order) return res.status(404).json({ success: false });
  let startDate = null, endDate = null;
  if (status === 'approved' && order.status !== 'approved') {
    startDate = new Date().toISOString();
    endDate = new Date(Date.now() + 30 * 86400000).toISOString();
    await sendTelegramMessage(order.phone, `✅ Your ${order.packageName} package has been activated! Expires in 30 days.`);
  }
  await database.updateOrderStatus(orderId, status, startDate, endDate);
  res.json({ success: true });
});

app.post('/api/admin/delete-order', verifyAdmin, async (req, res) => {
  const { orderId } = req.body;
  await database.deleteOrder(orderId);
  res.json({ success: true });
});

// ============ PUBLIC API ============
app.post('/api/order', [
  body('packageName').isIn(Object.keys(PACKAGES)),
  body('phone').matches(/^(09|\+959)[0-9]{7,9}$/)
], async (req, res) => {
  if (!validationResult(req).isEmpty()) return res.status(400).json({ success: false, message: "Invalid input" });
  const { packageName, phone, note, userId, userEmail, userName } = req.body;
  const mt = getMyanmarTime12hr();
  const newOrder = {
    orderId: 'ORD' + Date.now(),
    packageName, phone, price: PACKAGES[packageName].price,
    status: 'pending_payment', note: note || '',
    userId: userId || '', userEmail: userEmail || '', userName: userName || '',
    createdAt: mt.iso, createdAtMyanmar: mt.full
  };
  database.createOrder(newOrder, (err) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true, orderId: newOrder.orderId });
    sendTelegramMessage(ADMIN_CHAT_ID, `🆕 New Order: ${packageName}\n📞 ${phone}\n👤 ${userEmail || 'Guest'}`);
  });
});

app.post('/api/submit-payment', upload.single('screenshot'), async (req, res) => {
  const orderId = req.body.orderId;
  if (!req.file) return res.status(400).json({ success: false, message: "Screenshot required" });
  const orders = await database.getAllOrders();
  const order = orders.find(o => o.orderId === orderId);
  if (!order) return res.status(404).json({ success: false });
  await database.updateOrderScreenshot(order.id, `/temp_uploads/${req.file.filename}`);
  await database.updateOrderStatus(order.id, 'payment_received');
  if (req.body.note) await database.updateOrderNote(order.id, req.body.note);
  const fileBuffer = fs.readFileSync(req.file.path);
  const keyboard = {
    inline_keyboard: [[
      { text: "✅ Approve", callback_data: `approve_${order.id}` },
      { text: "❌ Reject", callback_data: `reject_${order.id}` }
    ]]
  };
  await sendTelegramPhoto(ADMIN_CHAT_ID, fileBuffer,
    `💰 Payment Received\nOrder: ${order.orderId}\nPackage: ${order.packageName}\nPhone: ${order.phone}`,
    keyboard);
  res.json({ success: true });
});

app.get('/api/track', async (req, res) => {
  const phone = req.query.phone;
  if (!phone) return res.json({ success: true, orders: [] });
  const orders = await database.getOrdersByPhone(phone);
  res.json({ success: true, orders });
});

app.get('/api/my-orders', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.json({ success: true, orders: [] });
  const orders = await database.getOrdersByUserId(userId);
  res.json({ success: true, orders });
});

// ============ Frontend Routes ============
app.get(ADMIN_PATH, (req, res) => res.sendFile(path.join(publicDir, 'admin.html')));
app.get('/', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

// ============ Start Server ============
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Frontend: ${BASE_URL}`);
  console.log(`🔧 Admin Panel: ${BASE_URL}${ADMIN_PATH}`);
  database.startExpiryChecker(60);
});
