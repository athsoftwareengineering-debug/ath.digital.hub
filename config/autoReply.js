const fs = require('fs');
const path = require('path');

// Load language files
const languages = {
    my: JSON.parse(fs.readFileSync(path.join(__dirname, 'languages/my.json'), 'utf8')),
    en: JSON.parse(fs.readFileSync(path.join(__dirname, 'languages/en.json'), 'utf8')),
    zh: JSON.parse(fs.readFileSync(path.join(__dirname, 'languages/zh.json'), 'utf8'))
};

let defaultLanguage = 'my';
const userLanguages = new Map();

// ==================== KEYWORDS ====================
const keywords = {
    dataMB: ['ဒေတာ ထည့်လို့ရသေးလား', 'mb ထည့်လို့ရသေးလား', 'data', 'mb', 'ဒေတာ'],
    vipPlan: ['plan', 'vip', 'အစီအစဉ်', 'စျေး', 'price', 'ဈေးနှုန်း'],
    priceAmount: ['15000', '20000', '25000', '30000', 'တစ်သောင်းခွဲ', 'နှစ်သောင်း', 'သုံးသောင်း'],
    payment: ['ငွေချေနည်း', 'ငွေပေးချေနည်း', 'ငွေဘယ်လိုချေရမလဲ', 'payment'],
    paymentDetail: ['ငွေချေနည်းကို ထပ်ရှင်းပြစမ်းပါ', 'နားမလည်ဘူး', 'အဆင့်ဆင့်ရှင်းပြစမ်းပါ'],
    noScreenshot: ['screenshot တင်လို့မရဘူး', 'နှိပ်လို့မရဘူး', 'ဓာတ်ပုံတင်လို့မရဘူး'],
    shopPurchase: ['ဘေဝယ်လို့ရလား', 'ဆိုင်သွားဝယ်လို့ရလား'],
    giftPurchase: ['အခြားသူအတွက်ဝယ်ပေးလို့ရလား', 'လက်ဆောင်ဝယ်ပေးလို့ရလား'],
    greeting: ['hi', 'hello', 'မင်္ဂလာပါ', 'ဟိုင်း'],
    help: ['help', 'အကူအညီ', 'ကူညီ'],
    accountIssue: ['အကောင့်ဝင်လို့မရဘူး', 'ဖုန်းနံပါတ်မေ့သွားတယ်', 'user id မေ့သွားတယ်'],
    orderStatus: ['ဒေတာ ထည့်ပြီးပြီလား', 'အော်ဒါရောက်ပြီလား'],
    orderLate: ['ဒေတာ ဝယ်ထားတာ ကြာလှနေပြီ', 'အော်ဒါမရောက်သေးဘူး'],
    transferStatus: ['ငွေလွှဲတာရောက်လား', 'ငွေလွှဲပြီးပြီလား', 'ငွေရောက်ပြီလား'],
    productList: ['နောက်ထပ် ဘာတွေရောင်းသေးလဲ', 'ဘာတွေရောင်းလဲ', 'တခြားဘာရသေးလဲ'],
    howLong: ['ဒေတာဝယ်ရင် ဘယ်လောက်ကြာလဲ', 'ဝယ်ပြီးရင် ဘယ်နှစ်မိနစ်ကြာမလဲ'],
    howToCheck: ['ရောက်မရောက် ဘယ်လိုစစ်ရမလဲ', 'အော်ဒါအခြေအနေ ဘယ်လိုစစ်ရမလဲ'],
    explainDetail: ['အသေးစိတ်ရှင်းပြပါ', 'ရှင်းပြပေးပါ'],
    howToBuy: ['ဘယ်အချိန်ထိ ဝယ်လို့ရလဲ', 'ဘယ်လိုဝယ်ရလဲ', 'ဝယ်ယူနည်းအဆင့်ဆင့်'],
    thankYou: ['ကျေးဇူးပါ', 'ကျေးဇူးတင်ပါတယ်', 'thanks', 'thank you'],
    cancelOrder: ['အော်ဒါဖျက်လို့ရလား', 'ငွေပြန်အမ်းလို့ရလား', 'refund'],
    complaint: ['တိုင်ကြားချင်တယ်', 'complaint', 'မကျေနပ်ဘူး', 'suggestion'],
    newAccount: ['အကောင့်အသစ်ဖွင့်', 'new account', 'register', 'sign up'],
    orderHistory: ['အော်ဒါမှတ်တမ်း', 'order history', 'ဝယ်ခဲ့ဖူးတာ'],
    serviceHours: ['ဘယ်အချိန်ဖွင့်လဲ', 'ဆိုင်ဖွင့်ချိန်', 'service hours'],
    responseTime: ['ပြန်ဖြေဖို့ဘယ်လောက်ကြာမလဲ', 'response time'],
    accountName: ['ဘယ်အကောင့်ကိုလွှဲရမလဲ', 'account name'],
    nowImmediately: ['အခုချက်ချင်းရလား', 'အခုရလား', 'အခုထည့်ပေးလို့ရလား'],
    promotion: ['ပရိုမိုးရှင်းရှိလား', 'promotion', 'အထူးကမ်းလှမ်းချက်'],
    discount: ['လျှော့စျေးရှိလား', 'discount', 'sale'],
    bestPlan: ['ဘယ် Plan က အကောင်းဆုံးလဲ', 'best plan'],
    multiplePhones: ['ဖုန်းအများကြီးထည့်လို့ရလား', 'multiple phones'],
    todayReceive: ['ဒီနေ့တင် ရမလား', 'today', 'ယနေ့'],
    whoWorks: ['ဘယ်သူတွေအလုပ်လုပ်လဲ', 'who works', 'team'],
    contact: ['တခြားဘယ်လိုဆက်သွယ်ရမလဲ', 'contact'],
    orderNumber: ['အော်ဒါအမှတ်', 'order number'],
    download: ['ဒေါင်းလုဒ်လုပ်လို့ရလား', 'အက်ပ်ဘယ်မှာရမလဲ', 'APK', 'iPhone ရလား', 'iOS ရလား', 'Android ရလား'],
    renewal: ['သက်တမ်းတိုးလို့ရလား', 'renewal'],
    personalQuestion: ['နေကောင်းလား', 'ဘာလုပ်နေလဲ', 'သေနေတာလား', 'အိပ်နေပီလား', 'ဘာစားချင်လဲ'],
    rudeWords: ['ငါလိုးမသား', 'လီးလား', 'မင်းမေလိုး', 'ခွေးမသား', 'သူတောင်းစား', 'shit', 'fuck', 'damn', 'stupid', 'idiot'],
    respectful: ['ကိုကြီး', 'အကို', 'ကိုကို', 'ဆရာ', 'ခင်ဗျား'],
    whoAreYou: ['ပြောစရာရှိလို့', 'အခုက ဘယ်သူလဲ', 'မင်းကဘယ်သူလဲ'],
    techSupport: ['error ပြနေတယ်', 'အလုပ်မလုပ်ဘူး', 'မရဘူး'],
    editOrder: ['အော်ဒါပြင်လို့ရလား', 'plan ပြောင်းချင်တယ်'],
    wrongTransfer: ['ငွေလွှဲမှားသွားတယ်', 'wrong transfer'],
    serviceDown: ['ဆာဗာပိတ်ထားလား', 'service down'],
    editAccount: ['username ပြောင်းချင်တယ်', 'account edit'],
    approvePayment: ['ငွေလွှဲထားတာ အတည်မပြုရသေးဘူး', 'approve payment'],
    phoneModel: ['iPhone ရော ရမလား', 'Android ပဲရမှာလား'],
    confirmTime: ['ငွေလွှဲအတည်ပြုဖို့ ဘယ်လောက်ကြာမလဲ', 'confirm time'],
    urgentOrder: ['အော်ဒါကို အမြန်ဆုံးလုပ်ပေးပါ', 'urgent order'],
    deleteAccount: ['အကောင့်ပိတ်လို့ရလား', 'account delete'],
    otherPayment: ['တခြားငွေပေးချေနည်းရှိလား', 'other payment'],
    resendOrder: ['အော်ဒါထပ်ပို့လို့ရလား', 'resend order'],
    safety: ['လုံခြုံရေးကော', 'is it safe', 'trust'],
    accountVerified: ['အကောင့်အတည်ပြုပြီးပြီလား', 'account verified'],
    notifyPromo: ['ပရိုမိုးရှင်းရှိရင် ပြောပါ', 'notify me'],
    exactTime: ['ဘယ်အချိန်မှာရမလဲ', 'exact time'],
    latestStatus: ['နောက်ဆုံးအခြေအနေပြောပါ', 'latest status']
};

function getUserLanguage(userId) {
    if (userLanguages.has(userId)) return userLanguages.get(userId);
    return defaultLanguage;
}

function setUserLanguage(userId, language) {
    if (['my', 'en', 'zh'].includes(language)) {
        userLanguages.set(userId, language);
        return true;
    }
    return false;
}

function getAutoReply(message, isShopOpen, userId = null) {
    const lowerMessage = message.toLowerCase().trim();
    const lang = userId ? getUserLanguage(userId) : defaultLanguage;
    const langData = languages[lang] || languages.my;
    
    for (const [category, keywordList] of Object.entries(keywords)) {
        for (const keyword of keywordList) {
            if (lowerMessage.includes(keyword.toLowerCase()) || lowerMessage === keyword.toLowerCase()) {
                const replyData = langData[category];
                if (replyData) {
                    return isShopOpen ? replyData.open : replyData.closed;
                }
            }
        }
    }
    
    return isShopOpen ? langData.default.open : langData.default.closed;
}

module.exports = { getAutoReply, setUserLanguage, getUserLanguage };
