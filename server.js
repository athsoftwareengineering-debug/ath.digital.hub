const express = require("express");
const bodyParser = require("body-parser");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
app.use(bodyParser.json());

// သင့် Token နဲ့ Admin ID ကို ဒီမှာ ထည့်ပါ
const TOKEN = "8930853709:AAHUjWhA2Uc47vcLQTSQ6jDyN7UYbEbkuyY";
const ADMIN_ID = 8070878424; // number အနေနဲ့ထားပါ၊ string မထားပါနဲ့

const bot = new TelegramBot(TOKEN, { polling: false }); // polling မလိုပါ

app.post("/order", (req, res) => {
  const { packageName, phone } = req.body;

  // input validation
  if (!packageName || !phone) {
    return res.status(400).json({ error: "Missing packageName or phone" });
  }

  const msg = `🆕 NEW ORDER

📦 Package: ${packageName}
📞 Phone: ${phone}`;

  // error handling ပါတဲ့ sendMessage
  bot.sendMessage(ADMIN_ID, msg)
    .then(() => {
      console.log("Telegram message sent successfully");
    })
    .catch((err) => {
      console.error("Telegram send error:", err.message);
      // သုံးစွဲသူကို error မပြပါနဲ့၊ backend log ထဲပဲထားပါ
    });

  res.json({ ok: true, message: "Order received" });
});

// health check endpoint (deploy platform တွေအတွက်)
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});