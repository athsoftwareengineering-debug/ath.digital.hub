// ========== COUNTDOWN & ALARM SYSTEM ==========

// Helper: Calculate remaining days
function calculateRemainingDays(endDate) {
  const today = new Date();
  const end = new Date(endDate);
  const diffTime = end - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Update all orders' remaining days (Run this every day)
function updateAllOrdersRemainingDays() {
  let updatedCount = 0;
  let expiredCount = 0;
  
  orders.forEach(order => {
    if (order.status === 'approved' && order.endDate) {
      const remaining = calculateRemainingDays(order.endDate);
      order.daysRemaining = remaining;
      
      // Check if expired
      if (remaining <= 0 && !order.isExpired) {
        order.isExpired = true;
        order.status = 'expired';
        expiredCount++;
        
        // Send expiration alert to admin
        sendTelegramMessage(ADMIN_CHAT_ID, 
          `⏰ **သက်တမ်းကုန်ဆုံးကြောင်း အကြောင်းကြားချက်**\n\n` +
          `📞 ဖုန်း: ${order.phone}\n` +
          `📦 Package: ${order.packageName}\n` +
          `📅 စတင်ရက်: ${new Date(order.startDate).toLocaleDateString('my-MM')}\n` +
          `📅 ကုန်ဆုံးရက်: ${new Date(order.endDate).toLocaleDateString('my-MM')}\n\n` +
          `⚠️ ဒေတာသက်တမ်း ကုန်ဆုံးသွားပါပြီ။`
        );
      }
      
      // Check if need to send alert (5, 3, 1 days remaining)
      const alertDays = [5, 3, 1];
      if (alertDays.includes(remaining) && order.lastAlertDay !== remaining && remaining > 0) {
        order.lastAlertDay = remaining;
        
        // Send alert to admin
        sendTelegramMessage(ADMIN_CHAT_ID,
          `⚠️ **ဒေတာသက်တမ်းကုန်ခါနီး အကြောင်းကြားချက်** ⚠️\n\n` +
          `📞 ဖုန်း: ${order.phone}\n` +
          `📦 Package: ${order.packageName}\n` +
          `⏳ ကျန်ရက်: ${remaining} ရက်\n` +
          `📅 ကုန်ဆုံးရက်: ${new Date(order.endDate).toLocaleDateString('my-MM')}\n\n` +
          `🔄 ပြန်လည်ဝယ်ယူရန် အကြောင်းကြားပါ။`
        );
        
        // Also send to group if you want
        if (GROUP_CHAT_ID) {
          sendTelegramMessage(GROUP_CHAT_ID,
            `🔔 **သတိပေးချက်** 🔔\n\n` +
            `📞 ဖုန်းနံပါတ်: ${order.phone}\n` +
            `⏳ ဒေတာသက်တမ်း ကုန်ဆုံးရန် **${remaining} ရက်** သာကျန်ပါတော့သည်။\n` +
            `💨 အခုပဲ ပြန်လည်မှာယူနိုင်ပါသည်။`
          );
        }
      }
      
      updatedCount++;
    }
  });
  
  console.log(`✅ Updated ${updatedCount} orders | ⏰ Expired: ${expiredCount}`);
  return { updatedCount, expiredCount };
}

// When admin approves order, set startDate and endDate
async function activateOrderWithCountdown(orderId) {
  const order = orders.find(o => o.id === parseInt(orderId));
  if (!order) return null;
  
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30);
  
  order.startDate = startDate.toISOString();
  order.endDate = endDate.toISOString();
  order.daysRemaining = 30;
  order.status = 'approved';
  order.updatedAt = new Date().toISOString();
  order.lastAlertDay = null;
  order.isExpired = false;
  
  // Send activation message to admin
  await sendTelegramMessage(ADMIN_CHAT_ID,
    `✅ **အော်ဒါအတည်ပြုပြီး Countdown စတင်ပါပြီ**\n\n` +
    `📞 ဖုန်း: ${order.phone}\n` +
    `📦 Package: ${order.packageName}\n` +
    `📅 စတင်ရက်: ${startDate.toLocaleDateString('my-MM')}\n` +
    `📅 ကုန်ဆုံးရက်: ${endDate.toLocaleDateString('my-MM')}\n` +
    `⏳ စုစုပေါင်း: 30 ရက်`
  );
  
  // Send to customer (if you have customer's Telegram)
  // await sendTelegramMessage(customerChatId, activationMessage);
  
  return order;
}

// Get order details with countdown for customer tracking
app.get('/api/track-order', (req, res) => {
  const { orderId, phone } = req.query;
  
  if (!orderId || !phone) {
    return res.status(400).json({ success: false, message: "Order ID and Phone required" });
  }
  
  const order = orders.find(o => o.id === parseInt(orderId) && o.phone === phone);
  
  if (!order) {
    return res.json({ success: false, message: "အော်ဒါမတွေ့ပါ။ ကျေးဇူးပြု၍ ပြန်စစ်ဆေးပါ။" });
  }
  
  let countdownInfo = null;
  if (order.startDate && order.endDate) {
    const remaining = calculateRemainingDays(order.endDate);
    countdownInfo = {
      startDate: order.startDate,
      endDate: order.endDate,
      daysRemaining: remaining > 0 ? remaining : 0,
      isExpired: remaining <= 0,
      statusMessage: remaining <= 0 ? "သက်တမ်းကုန်ဆုံးပါပြီ" : `ကျန်ရက် ${remaining} ရက်`
    };
  }
  
  res.json({
    success: true,
    order: {
      id: order.id,
      packageName: order.packageName,
      phone: order.phone,
      price: order.price,
      status: order.status,
      createdAt: order.createdAt,
      countdown: countdownInfo
    }
  });
});

// Get all active orders (for admin dashboard)
app.get('/api/admin/active-orders', (req, res) => {
  const activeOrders = orders
    .filter(o => o.status === 'approved' && !o.isExpired)
    .map(o => ({
      id: o.id,
      phone: o.phone,
      packageName: o.packageName,
      startDate: o.startDate,
      endDate: o.endDate,
      daysRemaining: calculateRemainingDays(o.endDate),
      price: o.price
    }))
    .sort((a, b) => a.daysRemaining - b.daysRemaining); // ကျန်ရက်နည်းတဲ့ဟာ အရင်ပါ
  
  res.json({ success: true, orders: activeOrders, count: activeOrders.length });
});

// Run daily check at specific time (using cron job)
// npm install node-cron
const cron = require('node-cron');

// Run every day at 9:00 AM
cron.schedule('0 9 * * *', () => {
  console.log('🔄 Running daily countdown check...');
  const result = updateAllOrdersRemainingDays();
  console.log(`📊 Daily update: ${result.updatedCount} orders checked, ${result.expiredCount} expired`);
});

// Also run on server startup
setTimeout(() => {
  updateAllOrdersRemainingDays();
}, 5000); // Run 5 seconds after server starts
