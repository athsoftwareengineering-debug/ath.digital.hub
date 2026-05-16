const express = require('express');
const path = require('path');
const multer = require('multer');
const { initializeApp, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const app = express();

// ========== MIDDLEWARE ==========
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ========== FILE UPLOAD ==========
const upload = multer({ storage: multer.memoryStorage() });

// ========== FIREBASE ADMIN INITIALIZATION ==========
// Note: Firebase Admin SDK အတွက် Service Account Key လိုအပ်ပါတယ်
// Render Environment Variable မှာ FIREBASE_SERVICE_ACCOUNT ထည့်ပေးရပါမယ်

let db;
try {
  // Service Account from Environment Variable
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : {
        "type": "service_account",
        "project_id": "restaurant-141f3",
        "private_key_id": "YOUR_PRIVATE_KEY_ID",
        "private_key": "YOUR_PRIVATE_KEY".replace(/\\n/g, '\n'),
        "client_email": "YOUR_CLIENT_EMAIL",
        "client_id": "YOUR_CLIENT_ID",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": "YOUR_CERT_URL"
      };
  
  initializeApp({
    credential: cert(serviceAccount),
    databaseURL: "https://restaurant-141f3-default-rtdb.firebaseio.com"
  });
  
  db = getDatabase();
  console.log("✅ Firebase connected successfully");
} catch (error) {
  console.error("❌ Firebase connection error:", error.message);
  console.log("⚠️ Running without Firebase (in-memory storage fallback)");
}

// ========== TELEGRAM BOT CONFIG ==========
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.CHAT_ID;

// Payment Info
const PAYMENT_INFO = {
  kpay: "09789999368",
  wavepay: "09789999368",
  name: "AUNG THU HTWE"
};

// Package Prices
const PACKAGES = {
  "VIP LEVEL - 1": { price: 15000, desc: "22GB / 8000 Mins / 5000 SMS" },
  "VIP LEVEL - 2": { price: 20000, desc: "40GB / 250 Mins / 25 Any Net" },
  "VIP LEVEL - 3": { price: 25000, desc: "40GB / 1400 Mins / 8000 SMS" },
  "VIP LEVEL - 4 (ULTRA)": { price: 30000, desc: "120GB High-Speed Data" }
};

// In-memory fallback (Firebase မရှိရင် သုံးမယ်)
let orders = [];
let orderIdCounter = 1;

// ========== HELPER: Save Order to Firebase ==========
async function saveOrderToFirebase(order) {
  if (!db) return null;
  try {
    const orderRef = db.ref(`orders/${order.id}`);
    await orderRef.set(order);
    return true;
  } catch (error) {
    console.error("Firebase save error:", error);
    return false;
  }
}

// ========== HELPER: Get Order from Firebase ==========
async function getOrderFromFirebase(orderId) {
  if (!db) return null;
  try {
    const snapshot = await db.ref(`orders/${orderId}`).once('value');
    return snapshot.val();
  } catch (error) {
    console.error("Firebase get error:", error);
    return null;
  }
}

// ========== HELPER: Get All Orders from Firebase ==========
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

// ========== HELPER: Update Order Status ==========
async function updateOrderStatus(orderId, status) {
  if (!db) {
    const order = orders.find(o => o.id == orderId);
    if (order) order.status = status;
    return order;
  }
  try {
    await db.ref(`orders/${orderId}/status`).set(status);
    await db.ref(`orders/${orderId}/updatedAt`).set(new Date().toISOString());
    return await getOrderFromFirebase(orderId);
  } catch (error) {
    console.error("Firebase update error:", error);
    return null;
  }
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
    if (keyboard) {
      body.reply_markup = JSON.stringify({ inline_keyboard: keyboard });
    }
    
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

// ========== WEBSITE ORDER ENDPOINT ==========
app.post('/order', async (req, res) => {
  try {
    const { packageName, phone, customerChatId } = req.body;
    
    if (!packageName || !phone) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    
    const packageData = PACKAGES[packageName];
    if (!packageData) {
      return res.status(400).json({ success: false, message: "Invalid package" });
    }
    
    // Create new order
    const newOrder = {
      id: db ? Date.now() : orderIdCounter++,
      packageName,
      phone,
      price: packageData.price,
      customerChatId: customerChatId || null,
      status: "pending_payment",
      paymentScreenshot: null,
      paymentNote: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Save to Firebase or memory
    if (db) {
      await saveOrderToFirebase(newOrder);
    } else {
      orders.unshift(newOrder);
    }
    
    // Send to Admin
    const adminMsg = `
🆕 **NEW ORDER CREATED**
━━━━━━━━━━━━━━━━━━━━
🆔 Order ID: \`${newOrder.id}\`
📦 Package: ${packageName}
📞 Phone: ${phone}
💰 Amount: ${packageData.price.toLocaleString()} KS
📅 Time: ${new Date().toLocaleString('my-MM')}
━━━━━━━━━━━━━━━━━━━━
✅ Status: Awaiting Payment Screenshot
    `;
    
    await sendTelegramMessage(ADMIN_CHAT_ID, adminMsg);
    
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
  try {
    const { orderId, packageName, phone, note } = req.body;
    const screenshot = req.file;
    
    if (!screenshot) {
      return res.status(400).json({ success: false, message: "Screenshot required" });
    }
    
    // Update order status
    await updateOrderStatus(orderId, 'payment_received');
    
    // Convert image to base64 for Telegram
    const base64Image = screenshot.buffer.toString('base64');
    const caption = `
📸 **PAYMENT SCREENSHOT RECEIVED**
━━━━━━━━━━━━━━━━━━━━
🆔 Order ID: ${orderId}
📦 Package: ${packageName}
📞 Phone: ${phone}
📝 Note: ${note || "None"}
━━━━━━━━━━━━━━━━━━━━
Use: /approve ${orderId} or /reject ${orderId}
    `;
    
    // Send to Admin via Telegram
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        photo: `data:image/jpeg;base64,${base64Image}`,
        caption: caption
      })
    });
    
    res.json({ success: true, message: "Payment submitted! Admin will verify." });
    
  } catch (error) {
    console.error("Payment submit error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ========== TELEGRAM WEBHOOK ==========
app.post(`/webhook/${BOT_TOKEN}`, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.sendStatus(200);
    
    const chatId = message.chat.id;
    const text = message.text || "";
    
    // Admin Commands
    if (chatId.toString() === ADMIN_CHAT_ID.toString()) {
      
      if (text === '/start') {
        await sendTelegramMessage(chatId, `
🤖 **MYTEL ORDER BOT - ADMIN PANEL**

📋 **Commands:**
/orders - View pending orders
/approve [id] - Approve order
/reject [id] - Reject order
/all - View all orders
/status [id] - Check order status
        `);
        return res.sendStatus(200);
      }
      
      if (text === '/orders') {
        const allOrders = db ? await getAllOrdersFromFirebase() : orders;
        const pendingOrders = allOrders.filter(o => o.status === 'pending_payment' || o.status === 'payment_received');
        
        if (pendingOrders.length === 0) {
          await sendTelegramMessage(chatId, "📭 No pending orders.");
          return res.sendStatus(200);
        }
        
        let msg = "📋 **PENDING ORDERS**\n━━━━━━━━━━━━━━━━━━\n";
        for (const order of pendingOrders) {
          const statusEmoji = order.status === 'payment_received' ? '💰' : '⏳';
          msg += `${statusEmoji} ID: \`${order.id}\` | ${order.packageName} | ${order.phone}\n`;
        }
        msg += "\nUse: `/approve [id]` or `/reject [id]`";
        await sendTelegramMessage(chatId, msg);
        return res.sendStatus(200);
      }
      
      if (text.startsWith('/approve')) {
        const id = parseInt(text.split(' ')[1]);
        const order = db ? await getOrderFromFirebase(id) : orders.find(o => o.id === id);
        
        if (!order) {
          await sendTelegramMessage(chatId, `❌ Order ID ${id} not found.`);
          return res.sendStatus(200);
        }
        
        await updateOrderStatus(id, 'approved');
        await sendTelegramMessage(chatId, `✅ Order #${id} has been **APPROVED**!`);
        
        if (order.customerChatId) {
          await sendTelegramMessage(order.customerChatId, `
✅ **ORDER APPROVED!** ✅
━━━━━━━━━━━━━━━━━━━━
🆔 Order ID: #${id}
📦 Package: ${order.packageName}
📞 Phone: ${order.phone}
━━━━━━━━━━━━━━━━━━━━
🎉 Data will be activated within 10 minutes!
          `);
        }
        return res.sendStatus(200);
      }
      
      if (text.startsWith('/reject')) {
        const id = parseInt(text.split(' ')[1]);
        const order = db ? await getOrderFromFirebase(id) : orders.find(o => o.id === id);
        
        if (!order) {
          await sendTelegramMessage(chatId, `❌ Order ID ${id} not found.`);
          return res.sendStatus(200);
        }
        
        await updateOrderStatus(id, 'rejected');
        await sendTelegramMessage(chatId, `❌ Order #${id} has been **REJECTED**.`);
        
        if (order.customerChatId) {
          await sendTelegramMessage(order.customerChatId, `
❌ **ORDER REJECTED** ❌
━━━━━━━━━━━━━━━━━━━━
🆔 Order ID: #${id}
📦 Package: ${order.packageName}
━━━━━━━━━━━━━━━━━━━━
⚠️ Payment could not be verified.
Contact admin: @Lifei090
          `);
        }
        return res.sendStatus(200);
      }
      
      if (text === '/all') {
        const allOrders = db ? await getAllOrdersFromFirebase() : orders;
        if (allOrders.length === 0) {
          await sendTelegramMessage(chatId, "📭 No orders yet.");
          return res.sendStatus(200);
        }
        
        let msg = "📋 **ALL ORDERS**\n━━━━━━━━━━━━━━━━━━\n";
        for (const order of allOrders.slice(0, 20)) {
          const statusEmoji = {
            'pending_payment': '⏳',
            'payment_received': '💰',
            'approved': '✅',
            'rejected': '❌'
          }[order.status] || '📌';
          msg += `${statusEmoji} #${order.id}: ${order.packageName} | ${order.status}\n`;
        }
        await sendTelegramMessage(chatId, msg);
        return res.sendStatus(200);
      }
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook error:", error);
    res.sendStatus(200);
  }
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

// ========== TEST ENDPOINT ==========
app.get('/test-bot', async (req, res) => {
  const testMsg = `✅ Bot is working! Time: ${new Date().toLocaleString('my-MM', { timeZone: 'Asia/Yangon' })}`;
  await sendTelegramMessage(ADMIN_CHAT_ID, testMsg);
  res.json({ success: true, message: "Test message sent!" });
});

// ========== ROOT ENDPOINT ==========
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== SERVER START ==========
const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📨 BOT_TOKEN: ${BOT_TOKEN ? '✅ Set' : '❌ Missing'}`);
  console.log(`👤 ADMIN_CHAT_ID: ${ADMIN_CHAT_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`🔥 Firebase: ${db ? '✅ Connected' : '❌ Not connected (using memory)'}`);
  await setWebhook();
});
