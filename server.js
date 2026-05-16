// Handle callback_data for approve/reject
if (callback_query) {
  // ... existing code ...
  
  if (data.startsWith('approve_')) {
    const orderId = parseInt(data.split('_')[1]);
    const order = db ? await getOrderFromFirebase(orderId) : orders.find(o => o.id === orderId);
    
    if (order) {
      await updateOrderStatus(orderId, 'approved');
      await sendTelegramMessage(chatId, `✅ Order #${orderId} approved!`, null, messageId);
      
      if (order.customerChatId) {
        await sendTelegramMessage(order.customerChatId, `✅ Your order #${orderId} has been approved! Data will be activated soon.`);
      }
    }
    return res.sendStatus(200);
  }
  
  if (data.startsWith('reject_')) {
    const orderId = parseInt(data.split('_')[1]);
    const order = db ? await getOrderFromFirebase(orderId) : orders.find(o => o.id === orderId);
    
    if (order) {
      await updateOrderStatus(orderId, 'rejected');
      await sendTelegramMessage(chatId, `❌ Order #${orderId} rejected.`, null, messageId);
      
      if (order.customerChatId) {
        await sendTelegramMessage(order.customerChatId, `❌ Your order #${orderId} was rejected. Please contact admin.`);
      }
    }
    return res.sendStatus(200);
  }
  
  if (data === 'payment_info') {
    const paymentMsg = `
💰 *PAYMENT INFORMATION*

🏧 *KPay / WavePay:* \`09789999368\`
👤 *Name:* AUNG THU HTWE

📌 *Note:* Customer must send screenshot after payment.

*Command to approve:* \`/approve [order_id]\`
*Command to reject:* \`/reject [order_id]\`
    `;
    await sendTelegramMessage(chatId, paymentMsg, null, messageId);
    return res.sendStatus(200);
  }
  
  if (data === 'refresh_stats') {
    const stats = await getOrderStats();
    await sendTelegramMessage(chatId, `🔄 *Stats Updated*\n\n${stats}`, null, messageId);
    return res.sendStatus(200);
  }
}
