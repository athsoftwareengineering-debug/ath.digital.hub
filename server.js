const express = require('express');
const path = require('path');
const multer = require('multer');
const admin = require('firebase-admin');

const app = express();

// ========== MIDDLEWARE ==========
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ========== FILE UPLOAD ==========
const upload = multer({ storage: multer.memoryStorage() });

// ========== FIREBASE INITIALIZATION ==========
let db = null;
let orders = [];
let orderIdCounter = 1;

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
  } catch (error) {
    console.error("❌ Firebase initialization error:", error.message);
    console.log("⚠️ Running without Firebase");
  }
} else {
  console.log("⚠️ FIREBASE_SERVICE_ACCOUNT not set");
}

// ========== HELPER FUNCTIONS ==========
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

async function getOrderFromFirebase(orderId) {
  if (!db) return orders.find(o => o.id == orderId);
  try {
    const snapshot = await db.ref(`orders/${orderId}`).once('value');
    return snapshot.val();
  } catch (error) {
    console.error("Firebase get error:", error);
    return null;
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

async function getOrderStats() {
  const allOrders = await getAllOrdersFromFirebase();
  const pending = allOrders.filter(o => o.status === 'pending_payment').length;
  const received = allOrders.filter(o => o.status === 'payment_received').length;
  const approved = allOrders.filter(o => o.status === 'approved').length;
  const rejected = allOrders.filter(o => o.status === 'rejected').length;
  return `📊 *Stats:*\n⏳ Pending: ${pending}\n💰 Received: ${received}\n✅ Approved: ${approved}\n❌ Rejected: ${rejected}`;
}

// ========== TELEGRAM BOT CONFIG ==========
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.CHAT_ID;

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

// ========== SEND TELEGRAM MESSAGE ==========
async function sendTelegramMessage(chatId, text, keyboard = null, replyToMessageId = null) {
  if (!BOT_TOKEN || !chatId) return false;
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const body = {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    };
    if (keyboard) body.reply_markup = JSON.stringify(keyboard);
    if (replyToMessageId) body.reply_to_message_id = replyToMessageId;
    
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
    
    const newOrder = {
      id: Date.now(),
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
    
    if (db) {
      await saveOrderToFirebase(newOrder);
    } else {
      orders.unshift(newOrder);
    }
    
    const adminMsg = `
🆕 **NEW ORDER CREATED**
━━━━━━━━━━━━━━━━━━━━
🆔 Order ID: \`${newOrder.id}\`
📦 Package: ${packageName}
📞 Phone: ${phone}
💰 Amount: ${packageData.price.toLocaleString()} KS
📅 Time: ${new Date().toLocaleString('my-MM')}
    `;
    await sendTelegramMessage(ADMIN_CHAT_ID, adminMsg);
    
    res.json({ success: true, orderId: newOrder.id, packageName, price: packageData.price, phone, paymentInfo: PAYMENT_INFO });
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
    
    await updateOrderStatus(orderId, 'payment_received');
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
    
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        photo: `data:image/jpeg;base64,${base64Image}`,
        caption: caption
      })
    });
    
    res.json({ success: true, message: "Payment submitted!" });
  } catch (error) {
    console.error("Payment submit error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ========== TELEGRAM WEBHOOK ==========
app.post(`/webhook/${BOT_TOKEN}`, async (req, res) => {
  try {
    const { message, callback_query } = req.body;
    
    // Handle Callback Query (Button clicks)
    if (callback_query) {
      const chatId = callback_query.message.chat.id;
      const data = callback_query.data;
      const messageId = callback_query.message.message_id;
      
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callback_query.id })
      });
      
      // Handle order action buttons
      if (data.startsWith('approve_')) {
        const orderId = parseInt(data.split('_')[1]);
        const order = await getOrderFromFirebase(orderId);
        if (order) {
          await updateOrderStatus(orderId, 'approved');
          await sendTelegramMessage(chatId, `✅ Order #${orderId} approved!`, null, messageId);
          if (order.customerChatId) {
            await sendTelegramMessage(order.customerChatId, `✅ Your order #${orderId} has been approved! Data will be activated soon.`);
          }
        }
        return res.sendStatus(200);
      }
      
      if (data.startsWith('reject_')) {
        const orderId = parseInt(data.split('_')[1]);
        const order = await getOrderFromFirebase(orderId);
        if (order) {
          await updateOrderStatus(orderId, 'rejected');
          await sendTelegramMessage(chatId, `❌ Order #${orderId} rejected.`, null, messageId);
          if (order.customerChatId) {
            await sendTelegramMessage(order.customerChatId, `❌ Your order #${orderId} was rejected. Please contact admin.`);
          }
        }
        return res.sendStatus(200);
      }
      
      if (data === 'view_orders') {
        const allOrders = await getAllOrdersFromFirebase();
        const pendingOrders = allOrders.filter(o => o.status === 'pending_payment' || o.status === 'payment_received');
        if (pendingOrders.length === 0) {
          await sendTelegramMessage(chatId, "📭 No pending orders.", null, messageId);
        } else {
          let msg = "📋 **PENDING ORDERS**\n━━━━━━━━━━━━━━━━━━\n";
          for (const order of pendingOrders.slice(0, 10)) {
            const statusEmoji = order.status === 'payment_received' ? '💰' : '⏳';
            msg += `${statusEmoji} *ID: ${order.id}*\n   📦 ${order.packageName}\n   📞 ${order.phone}\n\n`;
          }
          msg += "\nUse: `/approve [id]` or `/reject [id]`";
          await sendTelegramMessage(chatId, msg, null, messageId);
        }
        return res.sendStatus(200);
      }
      
      if (data === 'all_orders') {
        const allOrders = await getAllOrdersFromFirebase();
        if (allOrders.length === 0) {
          await sendTelegramMessage(chatId, "📭 No orders yet.", null, messageId);
        } else {
          let msg = "📋 **ALL ORDERS**\n━━━━━━━━━━━━━━━━━━\n";
          for (const order of allOrders.slice(0, 15)) {
            const statusEmoji = {
              'pending_payment': '⏳', 'payment_received': '💰', 'approved': '✅', 'rejected': '❌'
            }[order.status] || '📌';
            msg += `${statusEmoji} *${order.id}* | ${order.packageName}\n   📞 ${order.phone}\n   💰 ${order.price.toLocaleString()} KS\n\n`;
          }
          await sendTelegramMessage(chatId, msg, null, messageId);
        }
        return res.sendStatus(200);
      }
      
      if (data === 'payment_info') {
        const paymentMsg = `
💰 *PAYMENT INFORMATION*

🏧 *KPay / WavePay:* \`09789999368\`
👤 *Name:* AUNG THU HTWE

📌 *Note:* Customer must send screenshot after payment.

*Command to approve:* \`/approve [order_id]\`
*Command to reject:* \`/reject [order_id]\`
        `;
        await sendTelegramMessage(chatId, paymentMsg, null, messageId);
        return res.sendStatus(200);
      }
      
      if (data === 'refresh_stats') {
        const stats = await getOrderStats();
        await sendTelegramMessage(chatId, `🔄 *Stats Updated*\n\n${stats}`, null, messageId);
        return res.sendStatus(200);
      }
      
      if (data === 'help') {
        const helpMsg = `
🤖 *MYTEL ORDER BOT - HELP*

*Commands:*
/start - Show main menu
/orders - View pending orders
/approve [id] - Approve order
/reject [id] - Reject order
/all - View all orders
/status [id] - Check order status
        `;
        await sendTelegramMessage(chatId, helpMsg, null, messageId);
        return res.sendStatus(200);
      }
      
      return res.sendStatus(200);
    }
    
    // Handle regular messages
    if (!message) return res.sendStatus(200);
    const chatId = message.chat.id;
    const text = message.text || "";
    
    if (chatId.toString() === ADMIN_CHAT_ID.toString()) {
      if (text === '/start') {
        const stats = await getOrderStats();
        const menuMessage = `
🤖 *MYTEL ORDER BOT - ADMIN PANEL*

Welcome back, Admin! 👋

${stats}

🔽 *Use the buttons below:*
        `;
        const keyboard = {
          inline_keyboard: [
            [{ text: "📋 Pending Orders", callback_data: "view_orders" }, { text: "📜 All Orders", callback_data: "all_orders" }],
            [{ text: "💰 Payment Info", callback_data: "payment_info" }, { text: "❓ Help", callback_data: "help" }],
            [{ text: "🔄 Refresh Stats", callback_data: "refresh_stats" }]
          ]
        };
        await sendTelegramMessage(chatId, menuMessage, keyboard);
        return res.sendStatus(200);
      }
      
      if (text === '/orders') {
        const allOrders = await getAllOrdersFromFirebase();
        const pendingOrders = allOrders.filter(o => o.status === 'pending_payment' || o.status === 'payment_received');
        if (pendingOrders.length === 0) {
          await sendTelegramMessage(chatId, "📭 No pending orders.");
        } else {
          let msg = "📋 **PENDING ORDERS**\n━━━━━━━━━━━━━━━━━━\n";
          for (const order of pendingOrders) {
            msg += `🆔 ${order.id} | ${order.packageName} | ${order.phone}\n`;
          }
          await sendTelegramMessage(chatId, msg);
        }
        return res.sendStatus(200);
      }
      
      if (text.startsWith('/approve')) {
        const id = parseInt(text.split(' ')[1]);
        const order = await getOrderFromFirebase(id);
        if (!order) {
          await sendTelegramMessage(chatId, `❌ Order ID ${id} not found.`);
        } else {
          await updateOrderStatus(id, 'approved');
          await sendTelegramMessage(chatId, `✅ Order #${id} approved!`);
          if (order.customerChatId) {
            await sendTelegramMessage(order.customerChatId, `✅ Your order #${id} has been approved!`);
          }
        }
        return res.sendStatus(200);
      }
      
      if (text.startsWith('/reject')) {
        const id = parseInt(text.split(' ')[1]);
        const order = await getOrderFromFirebase(id);
        if (!order) {
          await sendTelegramMessage(chatId, `❌ Order ID ${id} not found.`);
        } else {
          await updateOrderStatus(id, 'rejected');
          await sendTelegramMessage(chatId, `❌ Order #${id} rejected.`);
          if (order.customerChatId) {
            await sendTelegramMessage(order.customerChatId, `❌ Your order #${id} was rejected.`);
          }
        }
        return res.sendStatus(200);
      }
      
      if (text === '/all') {
        const allOrders = await getAllOrdersFromFirebase();
        if (allOrders.length === 0) {
          await sendTelegramMessage(chatId, "📭 No orders yet.");
        } else {
          let msg = "📋 **ALL ORDERS**\n━━━━━━━━━━━━━━━━━━\n";
          for (const order of allOrders.slice(0, 20)) {
            msg += `${order.id} | ${order.packageName} | ${order.status}\n`;
          }
          await sendTelegramMessage(chatId, msg);
        }
        return res.sendStatus(200);
      }
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook error:", error);
    res.sendStatus(200);
  }
});

// ========== TEST ENDPOINT ==========
app.get('/test-bot', async (req, res) => {
  await sendTelegramMessage(ADMIN_CHAT_ID, "✅ Bot is working!");
  res.json({ success: true });
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
  console.log(`🔥 Firebase: ${db ? '✅ Connected' : '⚠️ Using memory'}`);
  await setWebhook();
});
