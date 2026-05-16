const express = require('express');
const path = require('path');

const app = express();

// ========== MIDDLEWARE ==========
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== STATIC FILES (HTML, CSS, JS) ==========
app.use(express.static(path.join(__dirname, 'public')));

// ========== TELEGRAM BOT CONFIGURATION ==========
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.CHAT_ID;  // Admin Telegram ID: 8070878424

// Payment Info (ငွေလွှဲရန် အချက်အလက်)
const PAYMENT_INFO = {
  kpay: "09789999368",
  wavepay: "09789999368",
  name: "AUNG THU HTWE"
};

// Package Prices
const PACKAGE_PRICES = {
  "VIP LEVEL - 1": 15000,
  "VIP LEVEL - 2": 20000,
  "VIP LEVEL - 3": 25000,
  "VIP LEVEL - 4 (ULTRA)": 30000
};

// ========== HELPER FUNCTION: Send Telegram Message ==========
async function sendTelegramMessage(chatId, text, parseMode = 'Markdown') {
  if (!BOT_TOKEN || !chatId) {
    console.error("Missing BOT_TOKEN or chatId");
    return false;
  }
  
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: parseMode
      })
    });
    const result = await response.json();
    return result.ok;
  } catch (error) {
    console.error("Telegram send error:", error);
    return false;
  }
}

// ========== TEST ENDPOINT ==========
app.get('/test-bot', async (req, res) => {
  try {
    if (!BOT_TOKEN || !ADMIN_CHAT_ID) {
      return res.status(500).json({ 
        success: false, 
        error: "BOT_TOKEN or CHAT_ID not set" 
      });
    }
    
    const testMsg = `✅ Bot is working! Time: ${new Date().toLocaleString('my-MM', { timeZone: 'Asia/Yangon' })}`;
    const success = await sendTelegramMessage(ADMIN_CHAT_ID, testMsg);
    
    if (success) {
      res.json({ success: true, message: "Test message sent to Telegram!" });
    } else {
      res.status(500).json({ success: false, error: "Failed to send message" });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== ORDER ENDPOINT (Customer အော်ဒါတင်တဲ့အခါ) ==========
app.post('/order', async (req, res) => {
  try {
    const { packageName, phone } = req.body;
    
    if (!packageName || !phone) {
      return res.status(400).json({ 
        success: false, 
        message: "Package name and phone number are required" 
      });
    }
    
    if (!BOT_TOKEN || !ADMIN_CHAT_ID) {
      console.error("Missing BOT_TOKEN or CHAT_ID");
      return res.status(500).json({ 
        success: false, 
        message: "Bot not configured properly" 
      });
    }
    
    const price = PACKAGE_PRICES[packageName] || 15000;
    const currentTime = new Date().toLocaleString('my-MM', { timeZone: 'Asia/Yangon' });
    
    // ===== 1. Admin ဆီသတင်းပို့ခြင်း (သင်ရတဲ့ Message) =====
    const adminMessage = `
🛒 **NEW MYTEL ORDER** 🛒
━━━━━━━━━━━━━━━━━━━━
📦 **Package:** ${packageName}
📞 **Phone:** ${phone}
💰 **Amount:** ${price.toLocaleString()} KS
━━━━━━━━━━━━━━━━━━━━
✅ Status: Pending Payment
🕐 Time: ${currentTime}
    `;
    
    const adminSent = await sendTelegramMessage(ADMIN_CHAT_ID, adminMessage);
    
    // ===== 2. Customer ဆီသတင်းပို့ခြင်း (Auto-reply with Payment Info) =====
    // မှတ်ချက်: ဒါက Customer ရဲ့ Telegram Chat ID မဟုတ်ဘဲ ဖုန်းနံပါတ်ပါ။
    // Telegram က phone number ကို chat_id အဖြစ် လက်မခံပါဘူး။
    // ဒါကြောင့် Customer Telegram ကို auto-reply လုပ်ချင်ရင် Customer Chat ID ထည့်ပေးဖို့လိုပါတယ်။
    // အခုတော့ Admin ဆီကိုပဲ သတင်းပို့ပြီး Admin က ကိုယ်တိုင်ပြန်ဖြေပါ။
    
    if (adminSent) {
      console.log(`✅ Order processed: ${packageName} for ${phone}`);
      res.status(200).json({ 
        success: true, 
        message: "Order placed successfully! Admin will contact you shortly.",
        orderDetails: { packageName, phone, price, time: currentTime }
      });
    } else {
      console.error("Failed to send admin notification");
      res.status(500).json({ 
        success: false, 
        message: "Order received but notification failed. Please try again." 
      });
    }
    
  } catch (error) {
    console.error("Order error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error. Please try again." 
    });
  }
});

// ========== GET ORDER HISTORY (Admin အတွက် - Optional) ==========
// သိမ်းထားတဲ့ Order တွေကို ကြည့်ချင်ရင် ထည့်ထားတာ
let orderHistory = [];  // Memory မှာ သိမ်းတယ် (Server restart ရင် ပျောက်မယ်)

app.get('/admin/orders', (req, res) => {
  // Simple auth - လုံခြုံရေးအတွက် Admin Key ထည့်ထားတယ်
  const adminKey = req.query.key;
  if (adminKey !== 'mytel_admin_2026') {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.json({ orders: orderHistory, count: orderHistory.length });
});

// Order endpoint မှာ history သိမ်းဖို့ (Optional)
app.post('/order', async (req, res) => {
  // ... (အပေါ်က code တွေအတိုင်း)
  
  // Order history ထဲသိမ်းတယ်
  const orderRecord = {
    id: Date.now(),
    packageName,
    phone,
    price: PACKAGE_PRICES[packageName] || 15000,
    time: new Date().toISOString(),
    status: "pending"
  };
  orderHistory.unshift(orderRecord);  // အသစ်ကို အပေါ်ဆုံးထည့်
  if (orderHistory.length > 100) orderHistory.pop();  // အဟောင်း 100 ပဲထား
  
  // ... (ကျန်တဲ့ code)
});

// ========== ROOT ENDPOINT ==========
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== SERVER START ==========
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📨 BOT_TOKEN: ${BOT_TOKEN ? '✅ Set' : '❌ Missing'}`);
  console.log(`📨 ADMIN_CHAT_ID: ${ADMIN_CHAT_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`💰 Payment Info: KPay/WavePay ${PAYMENT_INFO.kpay} (${PAYMENT_INFO.name})`);
  console.log(`📦 Packages: ${Object.keys(PACKAGE_PRICES).join(', ')}`);
});

// ========== KEEP ALIVE (Render မအိပ်အောင်) ==========
// Optional: Self-ping လုပ်ချင်ရင် သုံးလို့ရတယ်
if (process.env.SELF_PING === 'true') {
  const pingInterval = 14 * 60 * 1000; // 14 minutes
  setInterval(async () => {
    try {
      await fetch(`https://ath-digital-hub.onrender.com/`);
      console.log('🔄 Self-ping: Keep alive');
    } catch (e) {
      console.log('Self-ping failed');
    }
  }, pingInterval);
}
