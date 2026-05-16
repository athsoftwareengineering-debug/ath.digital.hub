const express = require("express");
const bodyParser = require("body-parser");
const TelegramBot = require("node-telegram-bot-api");

const app = express();

app.use(bodyParser.json());

const TOKEN = "8930853709:AAHUjWhA2Uc47vcLQTSQ6jDyN7UYbEbkuyY";
const ADMIN_ID = "8070878424";

const bot = new TelegramBot(TOKEN);

app.post("/order", (req, res) => {

  const { packageName, phone } = req.body;

  const msg = 
🆕 NEW ORDER

📦 Package: ${packageName}
📞 Phone: ${phone}
;

  bot.sendMessage(ADMIN_ID, msg);

  res.send({ ok: true });

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running");
});
