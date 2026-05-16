const express = require("express");
const bodyParser = require("body-parser");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
app.use(bodyParser.json());

const TOKEN = "8930853709:AAHUjWhA2Uc47vcLQTSQ6jDyN7UYbEbkuyY";
const ADMIN_ID = "8070878424";

const bot = new TelegramBot(TOKEN, { polling: true });

// TEST MESSAGE (server start တက်မလားစစ်)
bot.on("polling_error", console.log);

app.post("/order", (req, res) => {
  const { packageName, phone } = req.body;

  bot.sendMessage(ADMIN_ID,
    `🆕 NEW ORDER\n📦 ${packageName}\n📞 ${phone}`
  );

  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));