const express = require('express');
const app = express();

app.use(express.json());
app.use(express.static('public'));  // HTML file တွေထားဖို့

// Order endpoint
app.post('/order', (req, res) => {
  const { packageName, phone } = req.body;
  
  console.log(`New order: ${packageName} - ${phone}`);
  
  // ဒီမှာ Telegram / Discord / Email ပို့ဖို့ ထည့်နိုင်တယ်
  // သို့မဟုတ် Database ထဲသိမ်းဖို့ ထည့်နိုင်တယ်
  
  res.json({ success: true, message: "Order received" });
});

// Root endpoint
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
