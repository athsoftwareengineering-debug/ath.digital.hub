const express = require("express");
const bodyParser = require("body-parser");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
app.use(bodyParser.json());

const TOKEN = "8930853709:AAHUjWhA2Uc47vcLQTSQ6jDyN7UYbEbkuyY";
const ADMIN_ID = "8070878424";

// 🔥 IMPORTANT FIX HERE
const bot = new TelegramBot(TOKEN, { polling: false });

app.get("/", (req, res) => {
  res.send("Bot is running");
});

app.post("/order", (req, res) => {
  const { packageName, phone } = req.body;

  bot.sendMessage(ADMIN_ID,
    `🆕 NEW ORDER\n\n📦 Package: ${packageName}\n📞 Phone: ${phone}`
  ).then(() => {
    console.log("Message sent");
  }).catch(err => {
    console.log("Error:", err.response?.body || err);
  });

  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));