const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const admin = require('firebase-admin');

const app = express();

// ========== FIREBASE ADMIN SDK SETUP ==========
let serviceAccount;
let db = null;
let ordersCollection = null;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log('✅ Firebase service account loaded from environment');
  } else {
    const localPath = path.join(__dirname, 'firebase-service-account.json');
    if (fs.existsSync(localPath)) {
      serviceAccount = require(localPath);
      console.log('✅ Firebase service account loaded from local file');
    }
  }
} catch (error) {
  console.error('❌ Firebase service account error:', error.message);
}

if (serviceAccount && !admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    ordersCollection = db.collection('orders');
    console.log('✅ Firebase Admin SDK initialized successfully');
    console.log('🔥 Firestore database connected');
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
  }
} else if (admin.apps.length) {
  db = admin.firestore();
  ordersCollection = db.collection('orders');
  console.log('✅ Firebase already initialized');
} else {
  console.log('⚠️ Firebase not configured, using in-memory storage fallback');
}

// ========== MYANMAR TIME ZONE SETUP ==========
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
console.log(`📨 BOT_TOKEN: ${BOT_TOKEN ? '✅ SET' : '❌ MISSING'}`);
console.log(`👤 ADMIN_CHAT_ID: ${ADMIN_CHAT_ID ? '✅ SET' : '❌ MISSING'}`);
console.log(`👥 GROUP_CHAT_ID: ${GROUP_CHAT_ID ? '✅ SET' : '⚠️ NOT SET'}`);
console.log(`🔥 Firebase: ${ordersCollection ? '✅ CONNECTED' : '⚠️ NOT CONNECTED'}`);
console.log(`======================================\n`);

// ========== FALLBACK IN-MEMORY STORAGE ==========
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
      const updated = await getOrder(orderId);
      return updated;
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
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
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
  if (!BOT_TOKEN || !chatId) {
    console.log(`⚠️ Cannot send message: BOT_TOKEN=${!!BOT_TOKEN}, CHAT_ID=${!!chatId}`);
    return false;
  }
  
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const body = {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    };
    if (keyboard) {
      body.reply_markup = JSON.stringify(keyboard);
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    const result = await response.json();
    
    if (result.ok) {
      console.log(`✅ Telegram message sent to ${chatId}`);
    } else {
      console.log(`❌ Telegram error: ${result.description}`);
    }
    return result.ok;
  } catch (error) {
    console.error(`❌ Telegram send error: ${error.message}`);
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
    if (keyboard) {
      formData.append('reply_markup', JSON.stringify(keyboard));
    }
    
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    console.log(`📸 Photo send: ${result.ok ? '✅' : '❌'} ${result.description || ''}`);
    return result.ok;
  } catch (error) {
    console.error(`❌ Photo send error: ${error.message}`);
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

async function updateAllOrdersRemainingDays() {
  console.log('🔄 Running daily countdown check...');
  const orders = await getAllOrders();
  let updatedCount = 0;
  let expiredCount = 0;
  
  for (const order of orders) {
    if (order.status === 'approved' && order.endDate) {
      const remaining = calculateRemainingDays(order.endDate);
      await updateOrder(order.id, { daysRemaining: remaining });
      
      if (remaining <= 0 && !order.isExpired) {
        await updateOrder(order.id, { isExpired: true, status: 'expired' });
        expiredCount++;
        
        await sendTelegramMessage(ADMIN_CHAT_ID, 
          `⏰ *EXPIRED* Order #${order.id}\n\n📞 ${order.phone}\n📦 ${order.packageName}\n📅 Ended: ${new Date(order.endDate).toLocaleDateString()}`
        );
      }
      
      const alertDays = [5, 3, 1];
      if (alertDays.includes(remaining) && order.lastAlertDay !== remaining && remaining > 0) {
        await updateOrder(order.id, { lastAlertDay: remaining });
        
        await sendTelegramMessage(ADMIN_CHAT_ID,
          `⚠️ *REMINDER* Order #${order.id}\n\n📞 ${order.phone}\n📦 ${order.packageName}\n⏳ ${remaining} days remaining!\n📅 Expires: ${new Date(order.endDate).toLocaleDateString()}`
        );
        
        if (GROUP_CHAT_ID) {
          await sendTelegramMessage(GROUP_CHAT_ID,
            `🔔 *သတိပေးချက်*\n\n📞 ${order.phone}\n⏳ ${remaining} ရက်သာကျန်ပါတော့သည်။\n💨 အခုပဲ ပြန်လည်မှာယူနိုင်ပါသည်။`
          );
        }
      }
      updatedCount++;
    }
  }
  
  console.log(`✅ Updated: ${updatedCount} orders | ⏰ Expired: ${expiredCount}`);
}

// Daily scheduler at 9 AM Myanmar time
function scheduleDailyTask() {
  const now = new Date();
  const next9AM = new Date();
  next9AM.setHours(9, 0, 0, 0);
  if (now > next9AM) {
    next9AM.setDate(next9AM.getDate() + 1);
  }
  
  const msUntil9AM = next9AM - now;
  console.log(`⏰ Next countdown check at: ${next9AM.toLocaleString('en-US', { timeZone: 'Asia/Yangon', hour12: true })}`);
  
  setTimeout(() => {
    updateAllOrdersRemainingDays();
    scheduleDailyTask();
  }, msUntil9AM);
}

scheduleDailyTask();
setTimeout(() => updateAllOrdersRemainingDays(), 5000);

// ========== ADMIN AUTHENTICATION ==========
function isAuthenticated(req, res, next) {
  const authToken = req.headers['x-admin-auth'];
  if (authToken === ADMIN_PASSWORD) {
    return next();
  }
  res.status(401).json({ success: false, message: "Unauthorized" });
}

app.use('/api/admin/*', (req, res, next) => {
  if (req.path === '/api/admin/login') {
    return next();
  }
  isAuthenticated(req, res, next);
});

// ========== API ENDPOINTS ==========

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  console.log(`📝 Login attempt: username="${username}"`);
  
  if (password === ADMIN_PASSWORD) {
    console.log(`✅ Login successful`);
    res.json({ success: true, message: "Login successful" });
  } else {
    console.log(`❌ Login failed`);
    res.status(401).json({ success: false, message: "Invalid username or password" });
  }
});

// Create Order
app.post('/order', async (req, res) => {
  try {
    const { packageName, phone } = req.body;
    const myanmarTime = getMyanmarTime12hr();
    console.log(`📦 New order request: ${packageName} for ${phone}`);
    
    if (!packageName || !phone) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    
    const packageData = PACKAGES[packageName];
    if (!packageData) {
      return res.status(400).json({ success: false, message: "Invalid package" });
    }
    
    const newOrderId = await getNextOrderId();
    
    const newOrder = {
      id: newOrderId,
      packageName,
      phone,
      price: packageData.price,
      status: "pending_payment",
      createdAt: myanmarTime.iso,
      createdAtMyanmar: myanmarTime.full,
      updatedAt: myanmarTime.iso,
      startDate: null,
      endDate: null,
      daysRemaining: null,
      isExpired: false,
      lastAlertDay: null,
      screenshotPath: null
    };
    
    await saveOrder(newOrder);
    
    console.log(`✅ Order #${newOrder.id} created`);
    
    const adminMessage = `
🆕 *New Order Created* #${newOrder.id}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${packageName}
📞 Phone: ${phone}
💰 Price: ${packageData.price.toLocaleString()} KS
🕐 Time: ${myanmarTime.full}
    `;
    await sendTelegramMessage(ADMIN_CHAT_ID, adminMessage);
    
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

// Submit Payment with Screenshot
app.post('/submit-payment', upload.single('screenshot'), async (req, res) => {
  let tempFilePath = null;
  
  try {
    const orderId = parseInt(req.body.orderId);
    const packageName = req.body.packageName;
    const phone = req.body.phone;
    const note = req.body.note || '';
    const screenshot = req.file;
    const myanmarTime = getMyanmarTime12hr();
    
    console.log(`💰 Payment submission for order #${orderId}`);
    
    if (!screenshot) {
      return res.status(400).json({ success: false, message: "Screenshot required" });
    }
    
    const order = await getOrder(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    
    const screenshotPath = `/temp_uploads/${screenshot.filename}`;
    
    await updateOrder(orderId, {
      status: 'payment_received',
      updatedAt: myanmarTime.iso,
      screenshotPath: screenshotPath
    });
    
    tempFilePath = screenshot.path;
    const fileBuffer = fs.readFileSync(tempFilePath);
    
    const caption = `
💰 *Payment Received* #${orderId}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${order.packageName}
📞 Phone: ${order.phone}
💰 Amount: ${order.price.toLocaleString()} KS
📝 Note: ${note}
🕐 Time: ${myanmarTime.full}
    `;
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: "✅ Approve (Start 30 Days)", callback_data: `approve_${orderId}` },
          { text: "❌ Reject", callback_data: `reject_${orderId}` }
        ]
      ]
    };
    
    await sendTelegramPhoto(ADMIN_CHAT_ID, fileBuffer, caption, keyboard);
    
    res.json({ success: true, message: "Payment submitted! Admin will verify.", orderId: order.id });
    
  } catch (error) {
    console.error("Payment submit error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      console.log(`📸 Screenshot saved at: ${tempFilePath}`);
    }
  }
});

// Get Screenshot
app.get('/api/admin/order-screenshot', async (req, res) => {
  const authToken = req.headers['x-admin-auth'];
  if (authToken !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  
  const orderId = parseInt(req.query.orderId);
  const order = await getOrder(orderId);
  
  if (order && order.screenshotPath) {
    const fullUrl = `https://ath-digital-hub.onrender.com${order.screenshotPath}`;
    res.json({ success: true, screenshotUrl: fullUrl });
  } else {
    res.json({ success: false, message: "No screenshot available" });
  }
});

// Track Order
app.get('/api/track-order', async (req, res) => {
  const { orderId, phone } = req.query;
  
  if (!orderId || !phone) {
    return res.status(400).json({ success: false, message: "Order ID and Phone required" });
  }
  
  const order = await getOrder(parseInt(orderId));
  
  if (!order || order.phone !== phone) {
    return res.json({ success: false, message: "Order not found" });
  }
  
  let countdownInfo = null;
  if (order.startDate && order.endDate) {
    const remaining = calculateRemainingDays(order.endDate);
    countdownInfo = {
      startDate: order.startDate,
      endDate: order.endDate,
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
      createdAt: order.createdAt,
      countdown: countdownInfo
    }
  });
});

// Admin Orders API
app.get('/api/admin/orders', async (req, res) => {
  const authToken = req.headers['x-admin-auth'];
  if (authToken !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  
  const { status, page = 1, limit = 50 } = req.query;
  
  let allOrders = await getAllOrders();
  
  let filtered = [...allOrders];
  if (status && status !== 'all') {
    filtered = filtered.filter(o => o.status === status);
  }
  
  filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  const start = (parseInt(page) - 1) * parseInt(limit);
  const paginated = filtered.slice(start, start + parseInt(limit));
  
  const stats = {
    total: allOrders.length,
    pending: allOrders.filter(o => o.status === 'pending_payment').length,
    paid: allOrders.filter(o => o.status === 'payment_received').length,
    approved: allOrders.filter(o => o.status === 'approved').length,
    rejected: allOrders.filter(o => o.status === 'rejected').length,
    expired: allOrders.filter(o => o.status === 'expired').length,
    revenue: allOrders.filter(o => o.status === 'approved').reduce((sum, o) => sum + o.price, 0)
  };
  
  const formattedOrders = paginated.map(o => ({
    ...o,
    createdAtMyanmar: formatEnglishDate(o.createdAt)
  }));
  
  res.json({ success: true, orders: formattedOrders, total: filtered.length, stats });
});

// Update Order Status (with GROUP MESSAGE)
app.post('/api/admin/update-order', async (req, res) => {
  const authToken = req.headers['x-admin-auth'];
  if (authToken !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  
  const { orderId, status } = req.body;
  const order = await getOrder(parseInt(orderId));
  
  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }
  
  const myanmarTime = getMyanmarTime12hr();
  
  if (status === 'approved' && !order.startDate) {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    
    await updateOrder(parseInt(orderId), {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      daysRemaining: 30,
      status: 'approved',
      isExpired: false,
      updatedAt: myanmarTime.iso
    });
    
    await sendTelegramMessage(ADMIN_CHAT_ID, 
      `✅ Order #${orderId} approved! 30 days countdown started.\n📞 ${order.phone}\n📅 Expires: ${endDate.toLocaleDateString()}`
    );
    
    // 🚨 SEND TO GROUP
    if (GROUP_CHAT_ID) {
      const groupAlert = `
🚨 *MYTEL DATA ACTIVATED* 🚨
━━━━━━━━━━━━━━━━━━━━
✅ အော်ဒါ #${order.id} အတွက် ဒေတာသွင်းပြီးပါပြီ။
📞 ဖုန်းနံပါတ်: ${order.phone}
📦 Package: ${order.packageName}
💰 ပမာဏ: ${order.price.toLocaleString()} KS
📅 စတင်ရက်: ${formatEnglishDate(startDate)}
⏰ ကုန်ဆုံးရက်: ${formatEnglishDate(endDate)}
━━━━━━━━━━━━━━━━━━━━
👤 အတည်ပြုသူ: 𝐀𝐃𝐌𝐈𝐍 𝐒𝐔𝐏𝐏𝐎𝐑𝐓 | 𝟐𝟒/𝟕
      `;
      const sent = await sendTelegramMessage(GROUP_CHAT_ID, groupAlert);
      console.log(`📢 Group notification sent for order #${order.id}: ${sent}`);
    }
  } else if (status === 'rejected') {
    await updateOrder(parseInt(orderId), { 
      status: 'rejected', 
      updatedAt: myanmarTime.iso 
    });
    await sendTelegramMessage(ADMIN_CHAT_ID, `❌ Order #${orderId} rejected.`);
    
    if (GROUP_CHAT_ID) {
      const rejectAlert = `
⚠️ *အော်ဒါပယ်ဖျက်ခြင်း* ⚠️
━━━━━━━━━━━━━━━━━━━━
❌ အော်ဒါ #${order.id} အား ပယ်ဖျက်လိုက်ပါသည်။
📞 ဖုန်း: ${order.phone}
📦 Package: ${order.packageName}
📝 အကြောင်းရင်း: ငွေလွှဲ မှန်ကန်မှုမရှိပါ။
━━━━━━━━━━━━━━━━━━━━
👤 အတည်ပြုသူ: 𝐀𝐃𝐌𝐈𝐍 𝐒𝐔𝐏𝐏𝐎𝐑𝐓 | 𝟐𝟒/𝟕
      `;
      await sendTelegramMessage(GROUP_CHAT_ID, rejectAlert);
    }
  } else {
    await updateOrder(parseInt(orderId), { 
      status: status, 
      updatedAt: myanmarTime.iso 
    });
  }
  
  const updatedOrder = await getOrder(parseInt(orderId));
  res.json({ success: true, order: updatedOrder });
});

// ========== TEST GROUP ENDPOINT ==========
app.get('/test-group', async (req, res) => {
  console.log(`🔧 Testing group message to: ${GROUP_CHAT_ID}`);
  
  if (!GROUP_CHAT_ID) {
    return res.json({ 
      success: false, 
      error: "GROUP_CHAT_ID not configured in environment variables",
      hint: "Add GROUP_CHAT_ID to your Render.com environment variables"
    });
  }
  
  const testMessage = `
🧪 *Group Connection Test*
━━━━━━━━━━━━━━━━━━━━
✅ Bot is working in this group!
📅 Time: ${getMyanmarTime12hr().full}
📡 Group ID: ${GROUP_CHAT_ID}
━━━━━━━━━━━━━━━━━━━━
🎉 If you see this, group messaging is working!
  `;
  
  const result = await sendTelegramMessage(GROUP_CHAT_ID, testMessage);
  
  res.json({ 
    success: result, 
    message: result ? "✅ Message sent to group successfully!" : "❌ Failed to send message",
    groupId: GROUP_CHAT_ID,
    botTokenSet: !!BOT_TOKEN,
    adminChatIdSet: !!ADMIN_CHAT_ID,
    firebaseConnected: !!ordersCollection
  });
});

// ========== TELEGRAM WEBHOOK ==========
app.post(`/webhook/${BOT_TOKEN}`, async (req, res) => {
  try {
    const { callback_query } = req.body;
    
    if (callback_query && callback_query.data) {
      const data = callback_query.data;
      const chatId = callback_query.message.chat.id;
      
      console.log(`📨 Webhook callback: ${data}`);
      
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callback_query.id })
      });
      
      if (data.startsWith('approve_')) {
        const orderId = parseInt(data.split('_')[1]);
        const order = await getOrder(orderId);
        
        if (order && !order.startDate) {
          const startDate = new Date();
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + 30);
          
          await updateOrder(orderId, {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            daysRemaining: 30,
            status: 'approved',
            isExpired: false
          });
          
          await sendTelegramMessage(chatId, 
            `✅ Order #${orderId} approved! 30 days countdown started.\n\n📞 ${order.phone}\n📦 ${order.packageName}\n📅 Expires: ${endDate.toLocaleDateString()}`
          );
          
          if (GROUP_CHAT_ID) {
            const groupAlert = `
🚨 *MYTEL DATA ACTIVATED* 🚨
━━━━━━━━━━━━━━━━━━━━
✅ အော်ဒါ #${order.id} အတွက် ဒေတာသွင်းပြီးပါပြီ။
📞 ${order.phone}
📦 ${order.packageName}
💰 ${order.price.toLocaleString()} KS
📅 စတင်ရက်: ${formatEnglishDate(startDate)}
⏰ ကုန်ဆုံးရက်: ${formatEnglishDate(endDate)}
━━━━━━━━━━━━━━━━━━━━
👤 𝐀𝐃𝐌𝐈𝐍 𝐒𝐔𝐏𝐏𝐎𝐑𝐓 | 𝟐𝟒/𝟕
            `;
            await sendTelegramMessage(GROUP_CHAT_ID, groupAlert);
            console.log(`📢 Group notification sent via webhook for order #${order.id}`);
          }
        }
      }
      
      if (data.startsWith('reject_')) {
        const orderId = parseInt(data.split('_')[1]);
        const order = await getOrder(orderId);
        
        if (order) {
          await updateOrder(orderId, { status: 'rejected' });
          await sendTelegramMessage(chatId, `❌ Order #${orderId} rejected.`);
          
          if (GROUP_CHAT_ID) {
            const rejectAlert = `
⚠️ *အော်ဒါပယ်ဖျက်ခြင်း* ⚠️
━━━━━━━━━━━━━━━━━━━━
❌ အော်ဒါ #${order.id} အား ပယ်ဖျက်လိုက်ပါသည်။
📞 ${order.phone}
📦 ${order.packageName}
📝 အကြောင်းရင်း: ငွေလွှဲ မှန်ကန်မှုမရှိပါ။
━━━━━━━━━━━━━━━━━━━━
👤 𝐀𝐃𝐌𝐈𝐍 𝐒𝐔𝐏𝐏𝐎𝐑𝐓 | 𝟐𝟒/𝟕
            `;
            await sendTelegramMessage(GROUP_CHAT_ID, rejectAlert);
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
  console.log(`🕐 Myanmar Time: ${myanmarTime.full}`);
  console.log(`========================================`);
  console.log(`📨 BOT_TOKEN: ${BOT_TOKEN ? '✅' : '❌'}`);
  console.log(`👤 ADMIN_CHAT_ID: ${ADMIN_CHAT_ID ? '✅' : '❌'}`);
  console.log(`👥 GROUP_CHAT_ID: ${GROUP_CHAT_ID ? '✅' : '⚠️'}`);
  console.log(`🔥 Firebase: ${ordersCollection ? '✅ CONNECTED' : '⚠️ NOT CONNECTED'}`);
  console.log(`========================================`);
  console.log(`🔑 Admin Password: ${ADMIN_PASSWORD}`);
  console.log(`📱 Customer: https://ath-digital-hub.onrender.com/`);
  console.log(`👑 Admin: https://ath-digital-hub.onrender.com/admin`);
  console.log(`========================================\n`);
  
  if (BOT_TOKEN) {
    const webhookUrl = `https://ath-digital-hub.onrender.com/webhook/${BOT_TOKEN}`;
    try {
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
      const result = await response.json();
      console.log(`📡 Webhook: ${result.ok ? '✅' : '❌'} - ${result.description || ''}`);
    } catch (error) {
      console.error(`❌ Webhook error: ${error.message}`);
    }
  }
  
  setTimeout(async () => {
    if (ADMIN_CHAT_ID && BOT_TOKEN) {
      await sendTelegramMessage(ADMIN_CHAT_ID, 
        `🤖 *MYTEL Bot is Online!*\n\n✅ Server started at ${myanmarTime.full}\n🔥 Firebase: ${ordersCollection ? '✅ CONNECTED' : '⚠️ FALLBACK MODE'}\n🔧 Ready to receive orders.`
      );
    }
  }, 3000);
});

module.exports = app;
