// middleware/salesHours.js
let salesHours = {
    enabled: true,
    mode: 'auto',
    startHour: 9,
    endHour: 19,
    timezone: 'Asia/Yangon',
    manualStatus: false,
    message: 'ကျေးဇူးပြု၍ နံနက် ၉ နာရီမှ ညနေ ၇ နာရီအတွင်းမှသာ ဝယ်ယူနိုင်ပါသည်။'
};

function canPlaceOrder() {
    if (!salesHours.enabled) return true;
    if (salesHours.mode === 'manual') return salesHours.manualStatus;
    const now = new Date();
    const myanmarTime = new Date(now.toLocaleString('en-US', { timeZone: salesHours.timezone }));
    const currentHour = myanmarTime.getHours();
    return currentHour >= salesHours.startHour && currentHour < salesHours.endHour;
}

function getStatusMessage() {
    const isOpen = canPlaceOrder();
    if (!isOpen) return "🔴 ဆိုင်ပိတ်ထားပါသည်။ ကျေးဇူးပြု၍ နောက်မှထပ်မံဝယ်ယူပါ။";
    if (salesHours.mode === 'auto') {
        return `🟢 ဆိုင်ဖွင့်ချိန် (${salesHours.startHour}:00 မှ ${salesHours.endHour}:00)`;
    } else {
        return "🟢 ဆိုင်ဖွင့်ထားပါသည်။ ယခုပဲဝယ်ယူနိုင်ပါသည်။";
    }
}

module.exports = { salesHours, canPlaceOrder, getStatusMessage };
