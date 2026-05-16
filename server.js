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
const TELEGRAM_CHAT_ID = process.env.CHAT_ID;  // Your ID: 8070878424

// Order Endpoint
app.post('/order', async (req, res) => {
  try {
    const { packageName, phone } = req.body;
    
    console.log(`📦 New order: ${packageName} for ${phone}`);

    // Message to send to Telegram
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
        chat_id: TELEGRAM_CHAT_ID,  // 8070878424
        text: message,
        parse_mode: 'Markdown'
      })
    });

    const result = await response.json();
    
    if (result.ok) {
      console.log('✅ Telegram message sent to 8070878424');
      res.status(200).json({ success: true, message: "Order placed! Check Telegram." });
    } else {
      console.error('❌ Telegram error:', result);
      res.status(500).json({ success: false, message: "Telegram notification failed" });
    }

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📨 Telegram notifications will be sent to Chat ID: ${TELEGRAM_CHAT_ID}`);
});
