const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 🔑 CHANGE THIS
const TOKEN = "8930853709:AAHUjWhA2Uc47vcLQTSQ6jDyN7UYbEbkuyY";
const ADMIN_ID = "8070878424";

// Telegram bot
const bot = new TelegramBot(TOKEN);

app.get("/", (req, res) => {
  res.send("Server Running OK");
});

// ORDER API
app.post("/order", async (req, res) => {
  try {
    const { packageName, phone } = req.body;

    if (!packageName || !phone) {
      return res.json({ ok: false, msg: "Missing data" });
    }

    const message = `
🆕 NEW ORDER

📦 Package: ${packageName}
📞 Phone: ${phone}
`;

    await bot.sendMessage(ADMIN_ID, message);

    res.json({ ok: true });

  } catch (err) {
    console.log("ERROR:", err.response?.body || err);
    res.json({ ok: false });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server Running"));