const express = require("express");
const bodyParser = require("body-parser");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
app.use(bodyParser.json());

const TOKEN = "8930853709:AAHUjWhA2Uc47vcLQTSQ6jDyN7UYbEbkuyY";
const ADMIN_ID = "8070878424";

const bot = new TelegramBot(TOKEN);

app.get("/", (req, res) => {
  res.send("Server Running");
});

app.post("/order", (req, res) => {
  const { packageName, phone } = req.body;

  if (!packageName || !phone) {
    return res.json({ ok: false, msg: "Missing data" });
  }

  const msg = `
🆕 NEW ORDER

📦 Package: ${packageName}
📞 Phone: ${phone}
`;

  bot.sendMessage(ADMIN_ID, msg);

  res.json({ ok: true, msg: "Order Sent" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Running"));