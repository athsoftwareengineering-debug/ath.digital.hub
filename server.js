const express = require('express');
const path = require('path');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files (HTML, CSS, JS from public folder)
app.use(express.static(path.join(__dirname, 'public')));

// Telegram Bot Configuration (from Render Environment Variables)
const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.CHAT_ID;

// ========== TEST ENDPOINT (ဘော့အလုပ်လုပ်လား စမ်းဖို့) ==========
app.get('/test-bot', async (req, res) => {
  try {
    if (!BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      return res.status(500).json({ 
        success: false, 
        error: "BOT_TOKEN or CHAT_ID not set in Environment Variables" 
      });
    }
    
    const testMsg = `✅ Bot is working! Time: ${new Date().toLocaleString('my-MM', { timeZone: 'Asia/Yangon' })}`;
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${encodeURIComponent(testMsg)}`;
    
    const response = await fetch(url);
    const result = await response.json();
    
    if (result.ok) {
      res.json({ success: true, message: "Test message sent to Telegram! Check your Telegram.", telegramResponse: result });
    } else {
      res.status(500).json({ success: false, error: result.description, telegramResponse: result });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== ORDER ENDPOINT (Buy Now နှိပ်ရင် ဒီကိုရောက်မယ်) ==========
app.post('/order', async (req, res) => {
  try {
    const { packageName, phone } = req.body;
    
    console.log(`📦 New order: ${packageName} for ${phone}`);

    if (!BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error("Missing BOT_TOKEN or CHAT_ID");
      return res.status(500).json({ success: false, message: "Bot not configured properly" });
    }

    const message = `
🛒 **NEW MYTEL ORDER** 🛒
━━━━━━━━━━━━━━━━━━━━
📦 **Package:** ${packageName}
📞 **Phone:** ${phone}
━━━━━━━━━━━━━━━━━━━━
✅ Status: Pending
🕐 Time: ${new Date().toLocaleString('my-MM', { timeZone: 'Asia/Yangon' })}
    `;

    const telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    
    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    const result = await response.json();
    
    if (result.ok) {
      console.log('✅ Telegram message sent successfully');
      res.status(200).json({ success: true, message: "Order placed! Check Telegram." });
    } else {
      console.error('❌ Telegram error:', result);
      res.status(500).json({ success: false, message: `Telegram error: ${result.description}` });
    }

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ========== ROOT ENDPOINT ==========
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📨 BOT_TOKEN: ${BOT_TOKEN ? '✅ Set' : '❌ Missing'}`);
  console.log(`📨 CHAT_ID: ${TELEGRAM_CHAT_ID ? '✅ Set' : '❌ Missing'}`);
});
