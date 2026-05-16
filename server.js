const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const FormData = require('form-data');  // ← ဒီတစ်ကြောင်းပဲ ထပ်ထည့်ထားတယ်

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
const ALARM_GROUP_ID = "-1002373340084";

// In-memory storage
let orders = [];
let orderIdCounter = 1;

// Store pending orders waiting for screenshot
let pendingOrders = {};

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

// ========== HELPER FUNCTIONS ==========
async function updateOrderStatus(orderId, status) {
  const order = orders.find(o => o.id == orderId);
  if (order) {
    order.status = status;
    order.updatedAt = new Date().toISOString();
  }
  return order;
}

async function getOrderStats() {
  const pending = orders.filter(o => o.status === 'pending_payment').length;
  const received = orders.filter(o => o.status === 'payment_received').length;
  const approved = orders.filter(o => o.status === 'approved').length;
  const rejected = orders.filter(o => o.status === 'rejected').length;
  return `📊 *စာရင်းအင်း*\n⏳ ဆိုင်းငံ့: ${pending}\n💰 ငွေလွှဲပြီး: ${received}\n✅ အတည်ပြုပြီး: ${approved}\n❌ ပယ်ဖျက်ပြီး: ${rejected}`;
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
    if (keyboard) body.reply_markup = JSON.stringify(keyboard);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await response.json();
    console.log("Telegram send:", result.ok ? "✅" : "❌", result.description);
    return result.ok ? result.result : null;
  } catch (error) {
    console.error("Telegram send error:", error);
    return false;
  }
}

// Send photo to Telegram
async function sendTelegramPhoto(chatId, buffer, caption, keyboard = null) {
  if (!BOT_TOKEN) return false;
  try {
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('photo', buffer, {
      filename: 'screenshot.jpg',
      contentType: 'image/jpeg'
    });
    form.append('caption', caption);
    form.append('parse_mode', 'Markdown');
    if (keyboard) form.append('reply_markup', JSON.stringify(keyboard));
    
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });
    const result = await response.json();
    console.log("Telegram photo:", result.ok ? "✅" : "❌", result.description);
    return result.ok;
  } catch (error) {
    console.error("Telegram photo error:", error);
    return false;
  }
}

// ========== WEBSITE ORDER ENDPOINT (Save order but don't notify admin yet) ==========
app.post('/order', async (req, res) => {
  try {
    const { packageName, phone } = req.body;
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
      updatedAt: new Date().toISOString()
    };
    orders.unshift(newOrder);
    
    // Store temporarily - will send to admin when screenshot arrives
    pendingOrders[newOrder.id] = newOrder;
    
    console.log(`📦 Order #${newOrder.id} created - waiting for screenshot`);
    
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

// ========== SUBMIT PAYMENT SCREENSHOT (Send Order + SS together to Admin) ==========
app.post('/submit-payment', upload.single('screenshot'), async (req, res) => {
  let tempFilePath = null;
  
  try {
    console.log("🔔 Payment submission received with screenshot");
    
    const orderId = parseInt(req.body.orderId);
    const packageName = req.body.packageName;
    const phone = req.body.phone;
    const note = req.body.note;
    const screenshot = req.file;
    
    console.log("Order ID:", orderId);
    console.log("Package:", packageName);
    console.log("Phone:", phone);
    
    if (!screenshot) {
      return res.status(400).json({ success: false, message: "Screenshot required" });
    }
    
    if (!orderId) {
      return res.status(400).json({ success: false, message: "Order ID required" });
    }
    
    // Update order status
    await updateOrderStatus(orderId, 'payment_received');
    
    tempFilePath = screenshot.path;
    const fileBuffer = fs.readFileSync(tempFilePath);
    
    // Get order details
    const order = orders.find(o => o.id === orderId);
    const packageData = PACKAGES[order.packageName];
    
    // Send ONE message with Order + Screenshot together to Admin
    const caption = `
🆕 **အော်ဒါအသစ် + ငွေလွှဲပြေစာ** #${orderId}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${order.packageName}
📞 ဖုန်း: ${order.phone}
💰 ငွေပမာဏ: ${packageData.price.toLocaleString()} KS
📝 မှတ်ချက်: ${note || "မရှိ"}
📅 အချိန်: ${new Date().toLocaleString('my-MM')}
━━━━━━━━━━━━━━━━━━━━
⏳ **အတည်ပြုရန် အသင့်** - အောက်ပါခလုတ်များကို နှိပ်ပါ။
    `;
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: "✅ အတည်ပြုမည်", callback_data: `approve_${orderId}` },
          { text: "❌ ပယ်ဖျက်မည်", callback_data: `reject_${orderId}` }
        ],
        [
          { text: "📋 အသေးစိတ်", callback_data: `detail_${orderId}` }
        ]
      ]
    };
    
    const success = await sendTelegramPhoto(ADMIN_CHAT_ID, fileBuffer, caption, keyboard);
    
    // Remove from pending orders
    delete pendingOrders[orderId];
    
    if (success) {
      console.log(`✅ Order #${orderId} + screenshot sent to admin`);
      res.json({ success: true, message: "Order and payment submitted! Admin will verify." });
    } else {
      res.json({ success: false, message: "Telegram error. Please try again." });
    }
    
  } catch (error) {
    console.error("Payment submit error:", error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
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
        const order = orders.find(o => o.id === orderId);
        
        if (order) {
          await updateOrderStatus(orderId, 'approved');
          
          // Edit the original message to show approved
          const approveCaption = `
✅ **အတည်ပြုပြီး** - အော်ဒါ #${orderId}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${order.packageName}
📞 ဖုန်း: ${order.phone}
💰 ငွေပမာဏ: ${order.price.toLocaleString()} KS
📅 အတည်ပြုချိန်: ${new Date().toLocaleString('my-MM')}
━━━━━━━━━━━━━━━━━━━━
🎉 ဒေတာ သွင်းပေးပါမည်။ ကျေးဇူးတင်ပါသည်။
          `;
          
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageCaption`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              caption: approveCaption,
              parse_mode: 'Markdown'
            })
          });
          
          await sendTelegramMessage(chatId, `✅ အော်ဒါ #${orderId} အတည်ပြုပြီး!\n📞 ${order.phone}\n📦 ${order.packageName}`);
          
          // Send ALARM to GROUP
          const alarmMessage = `
╔════════════════════════════════════════════╗
║       ✅ ဒေတာ ထည့်သွင်းပြီးပါပြီ ✅          ║
╠════════════════════════════════════════════╣
║  🆔 အော်ဒါအမှတ်    : #${orderId}              ║
║  📦 Package        : ${order.packageName}   ║
║  📞 ဖုန်းနံပါတ်     : ${order.phone.slice(0, -4) + "****"} ║
║  💰 ငွေပမာဏ        : ${order.price.toLocaleString()} KS     ║
║  ✅ အခြေအနေ        : အောင်မြင်ပြီး           ║
║  ⏰ အချိန်          : ${new Date().toLocaleString('my-MM')}  ║
╠════════════════════════════════════════════╣
║  🎉 ကျေးဇူးတင်ပါတယ်။                     ║
║      ဒေတာ အသက်ဝင်ပါပြီ။                   ║
╚════════════════════════════════════════════╝
          `;
          await sendTelegramMessage(ALARM_GROUP_ID, alarmMessage);
          console.log(`📢 Alarm sent to group for order #${orderId}`);
        }
        return res.sendStatus(200);
      }
      
      // Reject Button
      if (data.startsWith('reject_')) {
        const orderId = parseInt(data.split('_')[1]);
        const order = orders.find(o => o.id === orderId);
        
        if (order) {
          await updateOrderStatus(orderId, 'rejected');
          
          const rejectCaption = `
❌ **ပယ်ဖျက်ပြီး** - အော်ဒါ #${orderId}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${order.packageName}
📞 ဖုန်း: ${order.phone}
💰 ငွေပမာဏ: ${order.price.toLocaleString()} KS
━━━━━━━━━━━━━━━━━━━━
⚠️ ငွေလွှဲပြေစာ မှားယွင်းနေပါသည်။
ကျေးဇူးပြု၍ ပြန်လည်စစ်ဆေးပါ။
          `;
          
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageCaption`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              caption: rejectCaption,
              parse_mode: 'Markdown'
            })
          });
          
          await sendTelegramMessage(chatId, `❌ အော်ဒါ #${orderId} ပယ်ဖျက်ပြီး.\n📞 ${order.phone}`);
        }
        return res.sendStatus(200);
      }
      
      // Detail Button
      if (data.startsWith('detail_')) {
        const orderId = parseInt(data.split('_')[1]);
        const order = orders.find(o => o.id === orderId);
        
        if (order) {
          const statusEmoji = {
            'pending_payment': '⏳ ဆိုင်းငံ့',
            'payment_received': '💰 ငွေလွှဲပြီး',
            'approved': '✅ အတည်ပြုပြီး',
            'rejected': '❌ ပယ်ဖျက်ပြီး'
          }[order.status] || order.status;
          
          const detailMsg = `
📋 **အော်ဒါအသေးစိတ်** #${order.id}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${order.packageName}
📞 ဖုန်း: ${order.phone}
💰 ငွေပမာဏ: ${order.price.toLocaleString()} KS
📅 ရက်စွဲ: ${new Date(order.createdAt).toLocaleString('my-MM')}
📊 အခြေအနေ: ${statusEmoji}
          `;
          
          const keyboard = {
            inline_keyboard: [
              [{ text: "✅ အတည်ပြုမည်", callback_data: `approve_${order.id}` }],
              [{ text: "❌ ပယ်ဖျက်မည်", callback_data: `reject_${order.id}` }],
              [{ text: "🔙 နောက်သို့", callback_data: "back_to_menu" }]
            ]
          };
          
          await sendTelegramMessage(chatId, detailMsg, keyboard);
        }
        return res.sendStatus(200);
      }
      
      // View Pending Orders
      if (data === 'view_pending') {
        const pendingOrdersList = orders.filter(o => o.status === 'payment_received');
        
        if (pendingOrdersList.length === 0) {
          await sendTelegramMessage(chatId, "📭 ဆိုင်းငံ့ထားသော အော်ဒါမရှိပါ။");
        } else {
          let msg = "📋 **ဆိုင်းငံ့ထားသော အော်ဒါများ**\n━━━━━━━━━━━━━━━━━━\n";
          const buttons = [];
          
          for (const order of pendingOrdersList.slice(0, 10)) {
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
        if (orders.length === 0) {
          await sendTelegramMessage(chatId, "📭 အော်ဒါမရှိသေးပါ။");
        } else {
          let msg = "📋 **အော်ဒါအားလုံး**\n━━━━━━━━━━━━━━━━━━\n";
          const buttons = [];
          
          for (const order of orders.slice(0, 15)) {
            const statusEmoji = {
              'pending_payment': '⏳', 'payment_received': '💰', 'approved': '✅', 'rejected': '❌'
            }[order.status] || '📌';
            msg += `${statusEmoji} *#${order.id}* | ${order.packageName}\n   📞 ${order.phone}\n   💰 ${order.price.toLocaleString()} KS\n\n`;
            buttons.push([{ text: `${statusEmoji} အော်ဒါ #${order.id}`, callback_data: `detail_${order.id}` }]);
          }
          
          buttons.push([{ text: "🔙 ပင်မစာမျက်နှာ", callback_data: "back_to_menu" }]);
          await sendTelegramMessage(chatId, msg, { inline_keyboard: buttons });
        }
        return res.sendStatus(200);
      }
      
      // Payment Info
      if (data === 'payment_info') {
        const paymentMsg = `
💰 **ငွေလွှဲအချက်အလက်**

🏧 *KPay / WavePay:* \`09789999368\`
👤 *Name:* AUNG THU HTWE

📌 Customer အား ငွေလွှဲပြီးပါက Screenshot ပေးပို့ရန် ပြောပါ။
        `;
        const keyboard = {
          inline_keyboard: [[{ text: "🔙 ပင်မစာမျက်နှာ", callback_data: "back_to_menu" }]]
        };
        await sendTelegramMessage(chatId, paymentMsg, keyboard);
        return res.sendStatus(200);
      }
      
      // Help
      if (data === 'help') {
        const helpMsg = `
🤖 *MYTEL ORDER BOT - အကူအညီ*

*ခလုတ်များ အသုံးပြုနည်း:*
• 📋 ဆိုင်းငံ့အော်ဒါများ - ငွေလွှဲပြီးသော အော်ဒါများ
• 📜 အော်ဒါအားလုံး - အော်ဒါမှတ်တမ်းအားလုံး
• 💰 ငွေလွှဲအချက်အလက် - Customer အတွက် ငွေလွှဲအကောင့်
• 🔄 စာရင်းအင်းအသစ် - လတ်တလောစာရင်းအင်းများ
        `;
        const keyboard = {
          inline_keyboard: [[{ text: "🔙 ပင်မစာမျက်နှာ", callback_data: "back_to_menu" }]]
        };
        await sendTelegramMessage(chatId, helpMsg, keyboard);
        return res.sendStatus(200);
      }
      
      // Refresh Stats
      if (data === 'refresh_stats') {
        const stats = await getOrderStats();
        await sendTelegramMessage(chatId, `🔄 *စာရင်းအင်းအသစ်*\n\n${stats}`);
        return res.sendStatus(200);
      }
      
      // Back to Menu
      if (data === 'back_to_menu') {
        const stats = await getOrderStats();
        const menuMessage = `
🤖 *MYTEL ORDER BOT - ADMIN PANEL*

မင်္ဂလာပါ Admin! 👋

${stats}

🔽 *အောက်ပါခလုတ်များကို အသုံးပြုပါ:*
        `;
        const keyboard = {
          inline_keyboard: [
            [{ text: "📋 ငွေလွှဲပြီးအော်ဒါများ", callback_data: "view_pending" }, { text: "📜 အော်ဒါအားလုံး", callback_data: "view_all" }],
            [{ text: "💰 ငွေလွှဲအချက်အလက်", callback_data: "payment_info" }, { text: "❓ အကူအညီ", callback_data: "help" }],
            [{ text: "🔄 စာရင်းအင်းအသစ်", callback_data: "refresh_stats" }]
          ]
        };
        await sendTelegramMessage(chatId, menuMessage, keyboard);
        return res.sendStatus(200);
      }
      
      return res.sendStatus(200);
    }
    
    if (!message) return res.sendStatus(200);
    const chatId = message.chat.id;
    const text = message.text || "";
    
    if (chatId.toString() === ADMIN_CHAT_ID.toString() && text === '/start') {
      const stats = await getOrderStats();
      const menuMessage = `
🤖 *MYTEL ORDER BOT - ADMIN PANEL*

မင်္ဂလာပါ Admin! 👋

${stats}

🔽 *အောက်ပါခလုတ်များကို အသုံးပြုပါ:*
      `;
      const keyboard = {
        inline_keyboard: [
          [{ text: "📋 ငွေလွှဲပြီးအော်ဒါများ", callback_data: "view_pending" }, { text: "📜 အော်ဒါအားလုံး", callback_data: "view_all" }],
          [{ text: "💰 ငွေလွှဲအချက်အလက်", callback_data: "payment_info" }, { text: "❓ အကူအညီ", callback_data: "help" }],
          [{ text: "🔄 စာရင်းအင်းအသစ်", callback_data: "refresh_stats" }]
        ]
      };
      await sendTelegramMessage(chatId, menuMessage, keyboard);
      return res.sendStatus(200);
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
  const menuMessage = `
🤖 *MYTEL ORDER BOT - ADMIN PANEL*

မင်္ဂလာပါ Admin! 👋

${stats}

🔽 *အောက်ပါခလုတ်များကို အသုံးပြုပါ:*
  `;
  const keyboard = {
    inline_keyboard: [
      [{ text: "📋 ငွေလွှဲပြီးအော်ဒါများ", callback_data: "view_pending" }, { text: "📜 အော်ဒါအားလုံး", callback_data: "view_all" }],
      [{ text: "💰 ငွေလွှဲအချက်အလက်", callback_data: "payment_info" }, { text: "❓ အကူအညီ", callback_data: "help" }],
      [{ text: "🔄 စာရင်းအင်းအသစ်", callback_data: "refresh_stats" }]
    ]
  };
  await sendTelegramMessage(ADMIN_CHAT_ID, menuMessage, keyboard);
  res.json({ success: true });
});

app.get('/orders-list', (req, res) => {
  res.json({ orders: orders, count: orders.length });
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
  console.log(`📢 ALARM_GROUP_ID: ${ALARM_GROUP_ID}`);
  await setWebhook();
});
