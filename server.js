const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();

// ========== MIDDLEWARE ==========
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ========== TELEGRAM CONFIG ==========
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.CHAT_ID;
const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID;

// ========== DATA STORAGE ==========
let orders = [];
let orderIdCounter = 1;

const PACKAGES = {
  "VIP LEVEL - 1": { price: 15000, desc: "22GB / 8000 Mins / 5000 SMS" },
  "VIP LEVEL - 2": { price: 20000, desc: "40GB / 250 Mins / 25 Any Net" },
  "VIP LEVEL - 3": { price: 25000, desc: "40GB / 1400 Mins / 8000 SMS" },
  "VIP LEVEL - 4 (ULTRA)": { price: 30000, desc: "120GB High-Speed Data" }
};

// ========== TELEGRAM SEND FUNCTION (FIXED) ==========
async function sendTelegramMessage(chatId, text, keyboard = null) {
  // Log for debugging
  console.log(`📤 Attempting to send to chatId: ${chatId}`);
  console.log(`📝 Message: ${text.substring(0, 100)}...`);
  
  // Check if token exists
  if (!BOT_TOKEN) {
    console.error("❌ BOT_TOKEN is missing! Please set it in environment variables.");
    return false;
  }
  
  if (!chatId) {
    console.error("❌ CHAT_ID is missing! Please set it in environment variables.");
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
    
    console.log(`🌐 Sending request to Telegram API...`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    const result = await response.json();
    
    if (result.ok) {
      console.log(`✅ Message sent successfully to ${chatId}`);
      return true;
    } else {
      console.error(`❌ Telegram API Error: ${result.description}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Network Error: ${error.message}`);
    return false;
  }
}

// Send photo to Telegram
async function sendTelegramPhoto(chatId, buffer, caption, keyboard = null) {
  console.log(`📸 Sending photo to ${chatId}...`);
  
  if (!BOT_TOKEN) {
    console.error("❌ BOT_TOKEN is missing!");
    return false;
  }
  
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
    
    if (result.ok) {
      console.log(`✅ Photo sent successfully to ${chatId}`);
      return true;
    } else {
      console.error(`❌ Telegram Photo Error: ${result.description}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Photo Send Error: ${error.message}`);
    return false;
  }
}

// ========== TEST TELEGRAM CONNECTION ==========
app.get('/test-telegram', async (req, res) => {
  console.log("🔧 Testing Telegram connection...");
  
  const testMessage = `
🤖 *MYTEL Bot Connection Test*
━━━━━━━━━━━━━━━━━━━━
✅ Bot is working properly!
📅 Time: ${new Date().toLocaleString()}
🔧 Status: Connected
━━━━━━━━━━━━━━━━━━━━
If you see this, the bot is configured correctly!
  `;
  
  const adminResult = await sendTelegramMessage(ADMIN_CHAT_ID, testMessage);
  
  let groupResult = false;
  if (GROUP_CHAT_ID) {
    groupResult = await sendTelegramMessage(GROUP_CHAT_ID, testMessage);
  }
  
  res.json({
    success: adminResult,
    botTokenSet: !!BOT_TOKEN,
    adminChatIdSet: !!ADMIN_CHAT_ID,
    groupChatIdSet: !!GROUP_CHAT_ID,
    adminMessageSent: adminResult,
    groupMessageSent: groupResult,
    botToken: BOT_TOKEN ? `${BOT_TOKEN.substring(0, 10)}...` : null,
    adminChatId: ADMIN_CHAT_ID,
    groupChatId: GROUP_CHAT_ID
  });
});

// ========== ORDER ENDPOINT ==========
app.post('/order', async (req, res) => {
  try {
    const { packageName, phone } = req.body;
    console.log(`📦 New order request: ${packageName} for ${phone}`);
    
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
      updatedAt: new Date().toISOString(),
      startDate: null,
      endDate: null,
      daysRemaining: null,
      isExpired: false,
      lastAlertDay: null
    };
    orders.unshift(newOrder);
    
    console.log(`✅ Order #${newOrder.id} created`);
    
    // 📤 Send notification to Admin via Telegram
    const adminMessage = `
🆕 *New Order Created* #${newOrder.id}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${packageName}
📞 Phone: ${phone}
💰 Price: ${packageData.price.toLocaleString()} KS
📅 Time: ${new Date().toLocaleString()}
━━━━━━━━━━━━━━━━━━━━
⏳ Status: Waiting for payment
    `;
    
    const sent = await sendTelegramMessage(ADMIN_CHAT_ID, adminMessage);
    
    if (!sent) {
      console.error("⚠️ Failed to send Telegram notification!");
    }
    
    res.json({ 
      success: true, 
      orderId: newOrder.id, 
      packageName, 
      price: packageData.price, 
      phone,
      telegramNotified: sent
    });
    
  } catch (error) {
    console.error("Order error:", error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
});

// ========== SUBMIT PAYMENT ENDPOINT ==========
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

app.post('/submit-payment', upload.single('screenshot'), async (req, res) => {
  let tempFilePath = null;
  
  try {
    const orderId = parseInt(req.body.orderId);
    const screenshot = req.file;
    
    console.log(`💰 Payment submission for order #${orderId}`);
    
    if (!screenshot) {
      return res.status(400).json({ success: false, message: "Screenshot required" });
    }
    
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    
    order.status = 'payment_received';
    order.updatedAt = new Date().toISOString();
    
    tempFilePath = screenshot.path;
    const fileBuffer = fs.readFileSync(tempFilePath);
    
    const caption = `
💰 *Payment Received* #${orderId}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${order.packageName}
📞 Phone: ${order.phone}
💰 Amount: ${order.price.toLocaleString()} KS
📅 Time: ${new Date().toLocaleString()}
━━━━━━━━━━━━━━━━━━━━
✅ Please verify and approve
    `;
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: "✅ Approve (Start 30 Days)", callback_data: `approve_${orderId}` },
          { text: "❌ Reject", callback_data: `reject_${orderId}` }
        ]
      ]
    };
    
    // Send to admin
    const sent = await sendTelegramPhoto(ADMIN_CHAT_ID, fileBuffer, caption, keyboard);
    
    if (!sent) {
      console.error("⚠️ Failed to send photo to Telegram!");
    }
    
    res.json({ success: true, message: "Payment submitted! Admin will verify." });
    
  } catch (error) {
    console.error("Payment submit error:", error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
});

// ========== TRACK ORDER ENDPOINT ==========
app.get('/api/track-order', (req, res) => {
  const { orderId, phone } = req.query;
  
  if (!orderId || !phone) {
    return res.status(400).json({ success: false, message: "Order ID and Phone required" });
  }
  
  const order = orders.find(o => o.id === parseInt(orderId) && o.phone === phone);
  
  if (!order) {
    return res.json({ success: false, message: "Order not found" });
  }
  
  res.json({
    success: true,
    order: {
      id: order.id,
      packageName: order.packageName,
      phone: order.phone,
      price: order.price,
      status: order.status,
      createdAt: order.createdAt
    }
  });
});

// ========== TELEGRAM WEBHOOK ==========
app.post(`/webhook/${BOT_TOKEN}`, async (req, res) => {
  try {
    console.log("📨 Webhook received:", JSON.stringify(req.body).substring(0, 200));
    
    const { callback_query } = req.body;
    
    if (callback_query && callback_query.data) {
      const data = callback_query.data;
      const chatId = callback_query.message.chat.id;
      const messageId = callback_query.message.message_id;
      
      // Answer callback query
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callback_query.id })
      });
      
      if (data.startsWith('approve_')) {
        const orderId = parseInt(data.split('_')[1]);
        const order = orders.find(o => o.id === orderId);
        
        if (order) {
          const startDate = new Date();
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + 30);
          
          order.startDate = startDate.toISOString();
          order.endDate = endDate.toISOString();
          order.daysRemaining = 30;
          order.status = 'approved';
          order.isExpired = false;
          
          await sendTelegramMessage(chatId, `✅ Order #${orderId} approved! 30 days countdown started.`);
          
          if (GROUP_CHAT_ID) {
            await sendTelegramMessage(GROUP_CHAT_ID, 
              `🚨 *DATA ACTIVATED* 🚨\n\n📞 ${order.phone}\n📦 ${order.packageName}\n⏳ 30 days valid`
            );
          }
        }
      }
      
      if (data.startsWith('reject_')) {
        const orderId = parseInt(data.split('_')[1]);
        const order = orders.find(o => o.id === orderId);
        if (order) {
          order.status = 'rejected';
          await sendTelegramMessage(chatId, `❌ Order #${orderId} rejected.`);
        }
      }
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook error:", error);
    res.sendStatus(200);
  }
});

// ========== ROOT ENDPOINT ==========
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== SERVER START ==========
const PORT = process.env.PORT || 10000;

app.listen(PORT, async () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`=================================`));
  console.log(`📨 BOT_TOKEN: ${BOT_TOKEN ? '✅ SET' : '❌ MISSING'}`);
  console.log(`👤 ADMIN_CHAT_ID: ${ADMIN_CHAT_ID ? '✅ SET' : '❌ MISSING'}`);
  console.log(`👥 GROUP_CHAT_ID: ${GROUP_CHAT_ID ? '✅ SET' : '⚠️ OPTIONAL'}`);
  console.log(`=================================\n`);
  
  // Set webhook
  if (BOT_TOKEN) {
    const webhookUrl = `https://ath-digital-hub.onrender.com/webhook/${BOT_TOKEN}`;
    console.log(`🔗 Setting webhook to: ${webhookUrl}`);
    
    try {
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
      const result = await response.json();
      console.log(`📡 Webhook: ${result.ok ? '✅ SUCCESS' : '❌ FAILED'} - ${result.description || ''}`);
    } catch (error) {
      console.error(`❌ Webhook error: ${error.message}`);
    }
  }
  
  // Send test message on startup
  setTimeout(async () => {
    console.log("\n🔧 Sending startup test message...");
    const testResult = await sendTelegramMessage(ADMIN_CHAT_ID, 
      `🤖 *MYTEL Bot is Online!*\n\n✅ Server started at ${new Date().toLocaleString()}\n🔧 Ready to receive orders.`
    );
    console.log(`📨 Startup test: ${testResult ? '✅ SENT' : '❌ FAILED'}\n`);
  }, 3000);
});
