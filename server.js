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

// ========== TELEGRAM SEND FUNCTION ==========
async function sendTelegramMessage(chatId, text, keyboard = null) {
  if (!BOT_TOKEN) {
    console.error("❌ BOT_TOKEN missing");
    return false;
  }
  
  if (!chatId) {
    console.error("❌ CHAT_ID missing");
    return false;
  }
  
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
    console.log(`Telegram send: ${result.ok ? '✅' : '❌'}`, result.description || '');
    return result.ok;
  } catch (error) {
    console.error("Telegram error:", error);
    return false;
  }
}

// ========== TEST TELEGRAM ENDPOINT ==========
app.get('/test-telegram', async (req, res) => {
  console.log("🔧 Test endpoint called");
  
  if (!BOT_TOKEN) {
    return res.json({
      success: false,
      error: "BOT_TOKEN not set",
      botTokenSet: false,
      adminChatIdSet: !!ADMIN_CHAT_ID
    });
  }
  
  if (!ADMIN_CHAT_ID) {
    return res.json({
      success: false,
      error: "CHAT_ID not set",
      botTokenSet: true,
      adminChatIdSet: false
    });
  }
  
  const testMessage = `
🤖 *MYTEL Bot Test*
━━━━━━━━━━━━━━━━━━
✅ Bot is working!
📅 Time: ${new Date().toLocaleString()}
👤 Admin ID: ${ADMIN_CHAT_ID}
━━━━━━━━━━━━━━━━━━
If you see this, setup is correct!
  `;
  
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text: testMessage,
        parse_mode: 'Markdown'
      })
    });
    
    const result = await response.json();
    
    res.json({
      success: result.ok,
      message: result.ok ? "Test message sent to Telegram!" : result.description,
      botTokenSet: true,
      adminChatIdSet: true,
      telegramResponse: result
    });
    
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      botTokenSet: true,
      adminChatIdSet: true
    });
  }
});

// ========== ORDER ENDPOINT ==========
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
    
    const newOrder = {
      id: orderIdCounter++,
      packageName,
      phone,
      price: packageData.price,
      status: "pending_payment",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    orders.unshift(newOrder);
    
    // Send to admin
    const adminMessage = `
🆕 *New Order* #${newOrder.id}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${packageName}
📞 Phone: ${phone}
💰 Price: ${packageData.price.toLocaleString()} KS
📅 Time: ${new Date().toLocaleString()}
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

// ========== TRACK ORDER ==========
app.get('/api/track-order', (req, res) => {
  const { orderId, phone } = req.query;
  
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

// ========== ROOT ==========
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== SERVER START ==========
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`=================================`);
  console.log(`📨 BOT_TOKEN: ${BOT_TOKEN ? '✅ SET' : '❌ MISSING'}`);
  console.log(`👤 ADMIN_CHAT_ID: ${ADMIN_CHAT_ID ? '✅ SET' : '❌ MISSING'}`);
  console.log(`=================================\n`);
  
  // Test endpoint URL
  console.log(`🔧 Test Telegram: https://localhost:${PORT}/test-telegram\n`);
});
