// middleware/salesHours.js
let salesHours = {
    enabled: true,
    startHour: 9,
    endHour: 19,
    timezone: 'Asia/Yangon',
    message: 'ကျေးဇူးပြု၍ နံနက် ၉ နာရီမှ ညနေ ၇ နာရီအတွင်းမှသာ ဝယ်ယူနိုင်ပါသည်။'
};

function canPlaceOrder() {
    if (!salesHours.enabled) return true;
    const now = new Date();
    const myanmarTime = new Date(now.toLocaleString('en-US', { timeZone: salesHours.timezone }));
    const currentHour = myanmarTime.getHours();
    return currentHour >= salesHours.startHour && currentHour < salesHours.endHour;
}

module.exports = { salesHours, canPlaceOrder };
