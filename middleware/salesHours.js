// middleware/salesHours.js

// ============ SALES HOURS CONFIGURATION ============
let salesHours = {
    enabled: true,
    mode: 'manual',          // 'auto' သို့မဟုတ် 'manual'
    startHour: 9,
    endHour: 19,
    timezone: 'Asia/Yangon',
    manualStatus: false,     // manual mode မှာ ဆိုင်ဖွင့်/ပိတ် သတ်မှတ်ချက်
    message: 'ကျေးဇူးပြု၍ နံနက် ၉ နာရီမှ ညနေ ၇ နာရီအတွင်းမှသာ ဝယ်ယူနိုင်ပါသည်။'
};

// ============ CAN PLACE ORDER FUNCTION ============
// ဒီ function က ဆိုင်ဖွင့်လား/ပိတ်လား စစ်ဆေးပေးပါတယ်။
function canPlaceOrder() {
    // 1. ဆိုင်လုံးဝပိတ်ထားရင် true ပြန်မယ် (အားလုံးဝယ်လို့ရမယ်)
    if (!salesHours.enabled) return true;
    
    // 2. Manual mode ဆိုရင် manualStatus ကို စစ်မယ်
    if (salesHours.mode === 'manual') {
        return salesHours.manualStatus;
    }
    
    // 3. Auto mode ဆိုရင် အချိန်နဲ့ စစ်မယ်
    const now = new Date();
    const myanmarTime = new Date(now.toLocaleString('en-US', { timeZone: salesHours.timezone }));
    const currentHour = myanmarTime.getHours();
    const currentMinute = myanmarTime.getMinutes();
    
    // စတင်ချိန်နဲ့ ပိတ်ချိန်ကြားမှာ ရှိမရှိ စစ်မယ်
    const startMinutes = salesHours.startHour * 60;
    const endMinutes = salesHours.endHour * 60;
    const currentMinutes = currentHour * 60 + currentMinute;
    
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

// ============ GET STATUS MESSAGE ============
function getStatusMessage() {
    const isOpen = canPlaceOrder();
    
    if (!isOpen) {
        if (salesHours.mode === 'manual') {
            return "🔴 ဆိုင်ပိတ်ထားပါသည်။ ကျေးဇူးပြု၍ နောက်မှထပ်မံဝယ်ယူပါ။";
        } else {
            return `🔴 ဆိုင်ပိတ်ချိန်ဖြစ်ပါသည်။ ဆိုင်ဖွင့်ချိန်: နံနက် ${salesHours.startHour}:00 မှ ညနေ ${salesHours.endHour}:00 ထိဖြစ်ပါသည်။`;
        }
    }
    
    if (salesHours.mode === 'auto') {
        return `🟢 ဆိုင်ဖွင့်ချိန် (${salesHours.startHour}:00 မှ ${salesHours.endHour}:00)`;
    } else {
        return "🟢 ဆိုင်ဖွင့်ထားပါသည်။ ယခုပဲဝယ်ယူနိုင်ပါသည်။";
    }
}

// ============ UPDATE SALES HOURS ============
function updateSalesHours(updates) {
    if (updates.enabled !== undefined) salesHours.enabled = updates.enabled;
    if (updates.mode !== undefined && (updates.mode === 'auto' || updates.mode === 'manual')) {
        salesHours.mode = updates.mode;
    }
    if (updates.startHour !== undefined && updates.startHour >= 0 && updates.startHour <= 23) {
        salesHours.startHour = updates.startHour;
    }
    if (updates.endHour !== undefined && updates.endHour >= 0 && updates.endHour <= 23) {
        salesHours.endHour = updates.endHour;
    }
    if (updates.manualStatus !== undefined) salesHours.manualStatus = updates.manualStatus;
    
    console.log('✅ Sales hours updated:', salesHours);
    return salesHours;
}

// ============ GET SALES HOURS ============
function getSalesHours() {
    return salesHours;
}

// ============ EXPORT ============
module.exports = { 
    salesHours, 
    canPlaceOrder, 
    getStatusMessage,
    updateSalesHours,
    getSalesHours
};

console.log('✅ salesHours.js middleware loaded successfully!');
console.log(`📊 Current mode: ${salesHours.mode}, Manual status: ${salesHours.manualStatus}`);
console.log(`📊 Shop is ${canPlaceOrder() ? 'OPEN' : 'CLOSED'}`);
