const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

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
const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID || "-1003783137346";

// In-memory storage
let orders = [];
let orderIdCounter = 1;
let pendingRejectReasons = {}; // Store pending reject reasons

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

// ========== HELPER FUNCTION for Myanmar Time (UTC+6:30) ==========
function getMyanmarTime(date = new Date()) {
  const myanmarOffset = 6.5 * 60 * 60 * 1000;
  const myanmarTime = new Date(date.getTime() + myanmarOffset);
  const year = myanmarTime.getUTCFullYear();
  const month = String(myanmarTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(myanmarTime.getUTCDate()).padStart(2, '0');
  let hours = myanmarTime.getUTCHours();
  const minutes = String(myanmarTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(myanmarTime.getUTCSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${month}/${day}/${year} ${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
}

// Calculate remaining days
function getRemainingDays(expiredAt) {
  const now = new Date();
  const expire = new Date(expiredAt);
  const diffTime = expire - now;
  if (diffTime <= 0) return 0;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

async function updateOrderStatus(orderId, status, approvedAt = null) {
  const order = orders.find(o => o.id == orderId);
  if (order) {
    order.status = status;
    order.updatedAt = new Date().toISOString();
    if (status === 'approved' && approvedAt) {
      order.approvedAt = approvedAt;
      const expireDate = new Date(approvedAt);
      expireDate.setDate(expireDate.getDate() + 30);
      order.expiredAt = expireDate.toISOString();
      order.isActive = true;
    }
  }
  return order;
}

async function getOrderStats() {
  const pending = orders.filter(o => o.status === 'pending_payment').length;
  const received = orders.filter(o => o.status === 'payment_received').length;
  const approved = orders.filter(o => o.status === 'approved' && o.isActive !== false).length;
  const expired = orders.filter(o => o.status === 'approved' && o.isActive === false).length;
  const rejected = orders.filter(o => o.status === 'rejected').length;
  const nearExpire = orders.filter(o => {
    if (o.status !== 'approved' || !o.isActive) return false;
    const daysLeft = getRemainingDays(o.expiredAt);
    return daysLeft > 0 && daysLeft <= 7;
  }).length;
  
  return {
    pending, received, approved, expired, rejected, nearExpire,
    text: `📊 *စာရင်းအင်း*
━━━━━━━━━━━━━━━━━━━━
⏳ ဆိုင်းငံ့: ${pending}
💰 ငွေလွှဲပြီး: ${received}
✅ အတည်ပြုပြီး: ${approved}
⚠️ ၇ ရက်အတွင်း Expire: ${nearExpire}
❌ Expired: ${expired}
🗑️ ပယ်ဖျက်ပြီး: ${rejected}`
  };
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
    console.log("Telegram send to:", chatId, "->", result.ok ? "✅" : "❌", result.description);
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
    form.append('photo', new Blob([buffer], { type: 'image/jpeg' }), 'screenshot.jpg');
    form.append('caption', caption);
    form.append('parse_mode', 'Markdown');
    if (keyboard) form.append('reply_markup', JSON.stringify(keyboard));
    
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: form
    });
    const result = await response.json();
    console.log("Telegram photo:", result.ok ? "✅" : "❌", result.description);
    return result.ok;
  } catch (error) {
    console.error("Telegram photo error:", error);
    return false;
  }
}

// ========== WEBSITE ORDER ENDPOINT ==========
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
      updatedAt: new Date().toISOString(),
      isActive: false
    };
    orders.unshift(newOrder);
    
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

// ========== SUBMIT PAYMENT SCREENSHOT ==========
app.post('/submit-payment', upload.single('screenshot'), async (req, res) => {
  let tempFilePath = null;
  
  try {
    console.log("🔔 Payment submission received with screenshot");
    
    const orderId = parseInt(req.body.orderId);
    const packageName = req.body.packageName;
    const phone = req.body.phone;
    const note = req.body.note;
    const screenshot = req.file;
    
    if (!screenshot) {
      return res.status(400).json({ success: false, message: "Screenshot required" });
    }
    
    if (!orderId) {
      return res.status(400).json({ success: false, message: "Order ID required" });
    }
    
    await updateOrderStatus(orderId, 'payment_received');
    
    tempFilePath = screenshot.path;
    const fileBuffer = fs.readFileSync(tempFilePath);
    
    const order = orders.find(o => o.id === orderId);
    const packageData = PACKAGES[order.packageName];
    
    const caption = `
🆕 **အော်ဒါအသစ် + ငွေလွှဲပြေစာ** #${orderId}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${order.packageName}
📞 ဖုန်း: ${order.phone}
💰 ငွေပမာဏ: ${packageData.price.toLocaleString()} KS
📝 မှတ်ချက်: ${note || "မရှိ"}
📅 အချိန်: ${getMyanmarTime()}
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

// ========== GET ORDER STATUS WITH EXPIRY (For Customer Website) ==========
app.get('/order-status/:phone', (req, res) => {
  const phone = req.params.phone;
  const userOrders = orders.filter(o => o.phone === phone && o.status === 'approved');
  
  const result = userOrders.map(order => {
    const daysLeft = order.expiredAt ? getRemainingDays(order.expiredAt) : 0;
    const isExpired = daysLeft <= 0;
    
    if (isExpired && order.isActive !== false) {
      order.isActive = false;
    }
    
    return {
      id: order.id,
      packageName: order.packageName,
      price: order.price,
      approvedAt: order.approvedAt ? getMyanmarTime(new Date(order.approvedAt)) : null,
      expiredAt: order.expiredAt ? getMyanmarTime(new Date(order.expiredAt)) : null,
      daysLeft: daysLeft,
      isActive: !isExpired,
      status: isExpired ? 'expired' : 'active'
    };
  });
  
  res.json({ success: true, orders: result, count: result.length });
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
          const approvedTime = new Date();
          await updateOrderStatus(orderId, 'approved', approvedTime);
          
          const expireDate = new Date(order.expiredAt);
          const daysUntilExpire = Math.ceil((expireDate - approvedTime) / (1000 * 60 * 60 * 24));
          
          const approveCaption = `
✅ **အတည်ပြုပြီး** - အော်ဒါ #${orderId}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${order.packageName}
📞 ဖုန်း: ${order.phone}
💰 ငွေပမာဏ: ${order.price.toLocaleString()} KS
📅 စတင်ရက်: ${getMyanmarTime(approvedTime)}
⏰ ကုန်ဆုံးရက်: ${getMyanmarTime(expireDate)}
⏳ အသုံးပြုနိုင်မည့်ရက်: ${daysUntilExpire} ရက်
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
          
          await sendTelegramMessage(ADMIN_CHAT_ID, `✅ အော်ဒါ #${orderId} အတည်ပြုပြီး!\n📞 ${order.phone}\n📦 ${order.packageName}\n⏰ ${daysUntilExpire} ရက် အသုံးပြုနိုင်မည်။`);
          
          if (GROUP_CHAT_ID) {
            const groupAlert = `
🚨 **ဒေတာသွင်းပြီးကြောင်း အကြောင်းကြားချက်** 🚨
━━━━━━━━━━━━━━━━━━━━
✅ အော်ဒါ #${orderId} အတွက် ဒေတာသွင်းပြီးပါပြီ။
📞 ဖုန်းနံပါတ်: ${order.phone}
📦 Package: ${order.packageName}
💰 ပမာဏ: ${order.price.toLocaleString()} KS
📅 စတင်ရက်: ${getMyanmarTime(approvedTime)}
⏰ ကုန်ဆုံးရက်: ${getMyanmarTime(expireDate)}
━━━━━━━━━━━━━━━━━━━━
👤 အတည်ပြုသူ: Admin
            `;
            await sendTelegramMessage(GROUP_CHAT_ID, groupAlert);
          }
        }
        return res.sendStatus(200);
      }
      
      // Reject Button - Ask for reason with Force Reply
      if (data.startsWith('reject_')) {
        const orderId = parseInt(data.split('_')[1]);
        const order = orders.find(o => o.id === orderId);
        
        if (order) {
          // Store that we're waiting for reason
          pendingRejectReasons[chatId] = { orderId, step: 'waiting_for_reason' };
          
          // Force reply keyboard - user can type message
          const forceReply = {
            force_reply: true,
            input_field_placeholder: "ပယ်ဖျက်ရသည့် အကြောင်းရင်းကို ရေးပါ..."
          };
          
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: `❌ အော်ဒါ #${orderId} ပယ်ဖျက်ရသည့် အကြောင်းရင်းကို ရေးပါ။\n\n(အောက်ပါစာသားအကွက်တွင် ရေးသားပါ)`,
              reply_markup: forceReply
            })
          });
        }
        return res.sendStatus(200);
      }
      
      // Detail Button
      if (data.startsWith('detail_')) {
        const orderId = parseInt(data.split('_')[1]);
        const order = orders.find(o => o.id === orderId);
        
        if (order) {
          let statusEmoji = '';
          let statusText = '';
          
          if (order.status === 'pending_payment') {
            statusEmoji = '⏳';
            statusText = 'ဆိုင်းငံ့';
          } else if (order.status === 'payment_received') {
            statusEmoji = '💰';
            statusText = 'ငွေလွှဲပြီး';
          } else if (order.status === 'approved') {
            if (order.isActive === false) {
              statusEmoji = '❌';
              statusText = 'Expired';
            } else {
              statusEmoji = '✅';
              statusText = 'အတည်ပြုပြီး (Active)';
            }
          } else if (order.status === 'rejected') {
            statusEmoji = '🗑️';
            statusText = 'ပယ်ဖျက်ပြီး';
          }
          
          let extraInfo = '';
          if (order.status === 'approved' && order.expiredAt) {
            const daysLeft = getRemainingDays(order.expiredAt);
            if (daysLeft > 0) {
              extraInfo = `\n⏳ ကျန်ရက်များ: ${daysLeft} ရက်\n📅 ကုန်ဆုံးရက်: ${getMyanmarTime(new Date(order.expiredAt))}`;
            } else {
              extraInfo = `\n❌ ဒေတာ သက်တမ်းကုန်ဆုံးပြီး`;
            }
          }
          
          const detailMsg = `
📋 **အော်ဒါအသေးစိတ်** #${order.id}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${order.packageName}
📞 ဖုန်း: ${order.phone}
💰 ငွေပမာဏ: ${order.price.toLocaleString()} KS
📅 ရက်စွဲ: ${getMyanmarTime(new Date(order.createdAt))}
📊 အခြေအနေ: ${statusEmoji} ${statusText}${extraInfo}
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
            let statusEmoji = '📌';
            if (order.status === 'pending_payment') statusEmoji = '⏳';
            else if (order.status === 'payment_received') statusEmoji = '💰';
            else if (order.status === 'approved') {
              if (order.isActive === false) statusEmoji = '❌';
              else statusEmoji = '✅';
            }
            else if (order.status === 'rejected') statusEmoji = '🗑️';
            
            msg += `${statusEmoji} *#${order.id}* | ${order.packageName}\n   📞 ${order.phone}\n   💰 ${order.price.toLocaleString()} KS`;
            
            if (order.status === 'approved' && order.expiredAt) {
              const daysLeft = getRemainingDays(order.expiredAt);
              if (daysLeft > 0) {
                msg += `\n   ⏳ ကျန်: ${daysLeft} ရက်`;
              } else {
                msg += `\n   ❌ Expired`;
              }
            }
            msg += `\n\n`;
            buttons.push([{ text: `${statusEmoji} အော်ဒါ #${order.id}`, callback_data: `detail_${order.id}` }]);
          }
          
          buttons.push([{ text: "🔙 ပင်မစာမျက်နှာ", callback_data: "back_to_menu" }]);
          await sendTelegramMessage(chatId, msg, { inline_keyboard: buttons });
        }
        return res.sendStatus(200);
      }
      
      // Near Expire Orders
      if (data === 'near_expire') {
        const nearExpireOrders = orders.filter(o => {
          if (o.status !== 'approved' || !o.isActive) return false;
          const daysLeft = getRemainingDays(o.expiredAt);
          return daysLeft > 0 && daysLeft <= 7;
        });
        
        if (nearExpireOrders.length === 0) {
          await sendTelegramMessage(chatId, "📭 ၇ ရက်အတွင်း သက်တမ်းကုန်မည့် အော်ဒါမရှိပါ။");
        } else {
          let msg = "⚠️ **၇ ရက်အတွင်း သက်တမ်းကုန်မည့် အော်ဒါများ**\n━━━━━━━━━━━━━━━━━━\n";
          for (const order of nearExpireOrders.slice(0, 10)) {
            const daysLeft = getRemainingDays(order.expiredAt);
            msg += `🔴 *#${order.id}* | ${order.packageName}\n   📞 ${order.phone}\n   ⏳ ကျန်: ${daysLeft} ရက်\n   📅 Expire: ${getMyanmarTime(new Date(order.expiredAt))}\n\n`;
          }
          const keyboard = {
            inline_keyboard: [[{ text: "🔙 ပင်မစာမျက်နှာ", callback_data: "back_to_menu" }]]
          };
          await sendTelegramMessage(chatId, msg, keyboard);
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
• 📋 ငွေလွှဲပြီးအော်ဒါများ - ငွေလွှဲပြီးသော အော်ဒါများ
• 📜 အော်ဒါအားလုံး - အော်ဒါမှတ်တမ်းအားလုံး (ကျန်ရက်များပါ)
• ⚠️ သက်တမ်းကုန်ခါနီး - ၇ ရက်အတွင်း Expire မည့်အော်ဒါများ
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
        await sendTelegramMessage(chatId, `🔄 *စာရင်းအင်းအသစ်*\n\n${stats.text}`);
        return res.sendStatus(200);
      }
      
      // Back to Menu
      if (data === 'back_to_menu') {
        const stats = await getOrderStats();
        const menuMessage = `
🤖 *MYTEL ORDER BOT - ADMIN PANEL*

မင်္ဂလာပါ Admin! 👋

${stats.text}

🔽 *အောက်ပါခလုတ်များကို အသုံးပြုပါ:*
        `;
        const keyboard = {
          inline_keyboard: [
            [{ text: "📋 ငွေလွှဲပြီးအော်ဒါများ", callback_data: "view_pending" }, { text: "📜 အော်ဒါအားလုံး", callback_data: "view_all" }],
            [{ text: "⚠️ သက်တမ်းကုန်ခါနီး", callback_data: "near_expire" }, { text: "💰 ငွေလွှဲအချက်အလက်", callback_data: "payment_info" }],
            [{ text: "❓ အကူအညီ", callback_data: "help" }, { text: "🔄 စာရင်းအင်းအသစ်", callback_data: "refresh_stats" }]
          ]
        };
        await sendTelegramMessage(chatId, menuMessage, keyboard);
        return res.sendStatus(200);
      }
      
      return res.sendStatus(200);
    }
    
    // Handle text messages (including reject reasons)
    if (!message) return res.sendStatus(200);
    const chatId = message.chat.id;
    const text = message.text || "";
    
    // Check if waiting for reject reason
    if (pendingRejectReasons[chatId] && pendingRejectReasons[chatId].step === 'waiting_for_reason') {
      const { orderId } = pendingRejectReasons[chatId];
      const order = orders.find(o => o.id === orderId);
      const reason = text;
      
      if (order && reason && !reason.startsWith('/')) {
        await updateOrderStatus(orderId, 'rejected');
        
        // Send reject message to admin
        const rejectMessage = `
❌ **ပယ်ဖျက်ပြီး** - အော်ဒါ #${orderId}
━━━━━━━━━━━━━━━━━━━━
📦 Package: ${order.packageName}
📞 ဖုန်း: ${order.phone}
💰 ငွေပမာဏ: ${order.price.toLocaleString()} KS
📝 ပယ်ဖျက်ရသည့်အကြောင်း: ${reason}
━━━━━━━━━━━━━━━━━━━━
⚠️ ကျေးဇူးပြု၍ ပြန်လည်စစ်ဆေးပြီး မှန်ကန်စွာ ငွေလွှဲပါ။
        `;
        await sendTelegramMessage(ADMIN_CHAT_ID, rejectMessage);
        
        // Send to GROUP with reason
        if (GROUP_CHAT_ID) {
          const groupAlert = `
⚠️ **အော်ဒါပယ်ဖျက်ခြင်း** ⚠️
━━━━━━━━━━━━━━━━━━━━
❌ အော်ဒါ #${orderId} အား ပယ်ဖျက်လိုက်ပါသည်။
📞 ဖုန်း: ${order.phone}
📦 Package: ${order.packageName}
📝 အကြောင်းရင်း: ${reason}
━━━━━━━━━━━━━━━━━━━━
⚠️ ကျေးဇူးပြု၍ ပြန်လည်စစ်ဆေးပါ။
          `;
          await sendTelegramMessage(GROUP_CHAT_ID, groupAlert);
        }
        
        // Confirm to admin who rejected
        await sendTelegramMessage(chatId, `✅ အော်ဒါ #${orderId} အား "${reason}" အကြောင်းဖြင့် ပယ်ဖျက်ပြီးပါပြီ။`);
        
        delete pendingRejectReasons[chatId];
      } else if (reason && reason.startsWith('/')) {
        // If user typed a command, ignore and clear
        delete pendingRejectReasons[chatId];
        await sendTelegramMessage(chatId, `❌ ပယ်ဖျက်ခြင်းကို ဖျက်သိမ်းလိုက်ပါသည်။`);
      }
      return res.sendStatus(200);
    }
    
    if (chatId.toString() === ADMIN_CHAT_ID.toString() && text === '/start') {
      const stats = await getOrderStats();
      const menuMessage = `
🤖 *MYTEL ORDER BOT - ADMIN PANEL*

မင်္ဂလာပါ Admin! 👋

${stats.text}

🔽 *အောက်ပါခလုတ်များကို အသုံးပြုပါ:*
      `;
      const keyboard = {
        inline_keyboard: [
          [{ text: "📋 ငွေလွှဲပြီးအော်ဒါများ", callback_data: "view_pending" }, { text: "📜 အော်ဒါအားလုံး", callback_data: "view_all" }],
          [{ text: "⚠️ သက်တမ်းကုန်ခါနီး", callback_data: "near_expire" }, { text: "💰 ငွေလွှဲအချက်အလက်", callback_data: "payment_info" }],
          [{ text: "❓ အကူအညီ", callback_data: "help" }, { text: "🔄 စာရင်းအင်းအသစ်", callback_data: "refresh_stats" }]
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

${stats.text}
  `;
  const keyboard = {
    inline_keyboard: [
      [{ text: "📋 ငွေလွှဲပြီးအော်ဒါများ", callback_data: "view_pending" }, { text: "📜 အော်ဒါအားလုံး", callback_data: "view_all" }],
      [{ text: "⚠️ သက်တမ်းကုန်ခါနီး", callback_data: "near_expire" }, { text: "💰 ငွေလွှဲအချက်အလက်", callback_data: "payment_info" }],
      [{ text: "❓ အကူအညီ", callback_data: "help" }, { text: "🔄 စာရင်းအင်းအသစ်", callback_data: "refresh_stats" }]
    ]
  };
  await sendTelegramMessage(ADMIN_CHAT_ID, menuMessage, keyboard);
  res.json({ success: true });
});

app.get('/orders-list', (req, res) => {
  res.json({ orders: orders, count: orders.length });
});

app.get('/test-group', async (req, res) => {
  try {
    if (!GROUP_CHAT_ID) {
      return res.json({ success: false, error: "GROUP_CHAT_ID not configured" });
    }
    const testMessage = `
🧪 *Group Connection Test*
━━━━━━━━━━━━━━━━━━━━
✅ Bot က Group ထဲကို message ပို့နိုင်ပါတယ်။
📅 အချိန်: ${getMyanmarTime()}
    `;
    const result = await sendTelegramMessage(GROUP_CHAT_ID, testMessage);
    res.json({ success: result, groupId: GROUP_CHAT_ID });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
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
  console.log(`👥 GROUP_CHAT_ID: ${GROUP_CHAT_ID ? '✅ Set' : '❌ Missing'}`);
  await setWebhook();
});
