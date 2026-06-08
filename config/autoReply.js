const fs = require('fs');
const path = require('path');

// Load language files
const languages = {
    my: JSON.parse(fs.readFileSync(path.join(__dirname, 'languages/my.json'), 'utf8')),
    en: JSON.parse(fs.readFileSync(path.join(__dirname, 'languages/en.json'), 'utf8')),
    zh: JSON.parse(fs.readFileSync(path.join(__dirname, 'languages/zh.json'), 'utf8'))
};

// Default language
let defaultLanguage = 'my';

// User language preferences (in-memory cache, can be moved to database)
const userLanguages = new Map();

// Keywords for each category (language independent)
const keywords = {
    dataMB: ['ဒေတာ ထည့်လို့ရသေးလား', 'mb ထည့်လို့ရသေးလား', 'data ထည့်လို့ရသေးလား', 'ဒေတာထည့်လို့ရသေးလား', 'data', 'mb', 'ဒေတာ'],
    vipPlan: ['plan', 'vip', 'အစီအစဉ်', 'စျေး', 'price', 'ဈေးနှုန်း'],
    priceAmount: ['15000', '20000', '25000', '30000', '၁၅၀၀၀', '၂၀၀၀၀', '၂၅၀၀၀', '၃၀၀၀၀', 'တစ်သောင်းခွဲ', 'နှစ်သောင်း', 'နှစ်သောင်းခွဲ', 'သုံးသောင်း'],
    payment: ['ငွေချေနည်း', 'ငွေပေးချေနည်း', 'ငွေဘယ်လိုချေရမလဲ', 'ငွေဘယ်လိုပေးရမလဲ', 'payment', 'ငွေရှင်းနည်း'],
    paymentDetail: ['ငွေချေနည်းကို ထပ်ရှင်းပြစမ်းပါ', 'ထပ်ရှင်းပြပါ', 'နားမလည်ဘူး', 'အဆင့်ဆင့်ရှင်းပြစမ်းပါ'],
    noScreenshot: ['screenshot တင်လို့မရဘူး', 'နှိပ်လို့မရဘူး', 'ဓာတ်ပုံတင်လို့မရဘူး', 'ပုံမတင်နိုင်ဘူး'],
    shopPurchase: ['ဘေဝယ်လို့ရလား', 'ဆိုင်သွားဝယ်လို့ရလား', 'လာဝယ်လို့ရလား'],
    giftPurchase: ['အခြားသူအတွက်ဝယ်ပေးလို့ရလား', 'ဖုန်းနောက်တစ်လုံးနဲ့ဝယ်လို့ရလား', 'သူများဖုန်းကိုဝယ်ပေးလို့ရလား', 'လက်ဆောင်ဝယ်ပေးလို့ရလား'],
    greeting: ['hi', 'hello', 'မင်္ဂလာပါ', 'ဟိုင်း', 'ဟယ်လို'],
    help: ['help', 'အကူအညီ', 'ကူညီ', 'အကူအညီလိုတယ်'],
    accountIssue: ['အကောင့်ဝင်လို့မရဘူး', 'ဖုန်းနံပါတ်မေ့သွားတယ်', 'login မဝင်နိုင်ဘူး', 'user id မေ့သွားတယ်', 'အကောင့်ပျောက်သွားတယ်', 'username မေ့သွားတယ်'],
    orderStatus: ['ဒေတာ ထည့်ပြီးပြီလား', 'mb ထည့်ပြီးပြီလား', 'data ထည့်ပြီးပြီလား', 'အော်ဒါရောက်ပြီလား', 'ကျွန်တော့်အော်ဒါ ရောက်ပြီလား'],
    orderLate: ['ဒေတာ ဝယ်ထားတာ ကြာလှနေပြီ', 'ကြာလှနေပြီ မရောက်သေးဘူး', 'အော်ဒါမရောက်သေးဘူး', 'ဝယ်ထားတာ ကြာပြီ'],
    transferStatus: ['ငွေလွှဲတာရောက်လား', 'ငွေလွှဲပြီးပြီလား', 'ငွေရောက်ပြီလား', 'ငွေလွှဲထားတယ် ရောက်ပြီလား'],
    productList: ['နောက်ထပ် ဘာတွေရောင်းသေးလဲ', 'ဘာတွေရောင်းလဲ', 'ထုတ်ကုန်တွေဘာတွေရှိလဲ', 'ဘာတွေထပ်ရှိသေးလဲ', 'တခြားဘာရသေးလဲ'],
    howLong: ['ဒေတာဝယ်ရင် ဘယ်လောက်ကြာလဲ', 'mb ဝယ်ရင် ဘယ်လောက်ကြာမလဲ', 'ဝယ်ပြီးရင် ဘယ်နှစ်မိနစ်ကြာမလဲ'],
    howToCheck: ['ရောက်မရောက် ဘယ်လိုစစ်ရမလဲ', 'အော်ဒါအခြေအနေ ဘယ်လိုစစ်ရမလဲ', 'ဘယ်လိုစစ်ကြည့်ရမလဲ'],
    explainDetail: ['အသေးစိတ်ရှင်းပြပါ', 'အသေးစိတ်ပြောပြပါ', 'ရှင်းပြပေးပါ', 'အသေးစိတ်သိချင်တယ်'],
    howToBuy: ['ဘယ်အချိန်ထိ ဝယ်လို့ရလဲ', 'ဘယ်လိုဝယ်ရလဲ', 'ဘယ်လိုမျိုးဝယ်ယူရမလဲ', 'ဝယ်ယူနည်းအဆင့်ဆင့်', 'ဘယ်အချိန်အထိရလဲ'],
    thankYou: ['ကျေးဇူးပါ', 'ကျေးဇူးတင်ပါတယ်', 'thanks', 'thank you'],
    cancelOrder: ['အော်ဒါဖျက်လို့ရလား', 'order cancel', 'ဖျက်သိမ်းလို့ရလား', 'ငွေပြန်အမ်းလို့ရလား', 'refund', 'ငွေပြန်အမ်းလား', 'ငွေပြန်အမ်းပေးလား', 'ပိုက်ဆံပြန်ပေးလား', 'ငွေပြန်ပေးလား'],
    complaint: ['တိုင်ကြားချင်တယ်', 'complaint', 'မကျေနပ်ဘူး', 'အကြံပြု', 'suggestion', 'ဝန်ဆောင်မှုမကျေနပ်ဘူး'],
    newAccount: ['အကောင့်အသစ်ဖွင့်', 'အသစ်ဖွင့်', 'new account', 'register', 'sign up'],
    orderHistory: ['အော်ဒါမှတ်တမ်း', 'order history', 'ဝယ်ခဲ့ဖူးတာ', 'အရင်အမိန့်စာ'],
    serviceHours: ['ဘယ်အချိန်ဖွင့်လဲ', 'ဆိုင်ဖွင့်ချိန်', 'ဝန်ဆောင်မှုချိန်', 'service hours'],
    responseTime: ['ပြန်ဖြေဖို့ဘယ်လောက်ကြာမလဲ', 'response time', 'ပြန်စာကြာ'],
    accountName: ['ဘယ်အကောင့်ကိုလွှဲရမလဲ', 'account name', 'အကောင့်နာမည်'],
    nowImmediately: ['အခုချက်ချင်းရလား', 'အခုရလား', 'အခုထည့်ပေးလို့ရလား', 'ချက်ချင်းရနိုင်မလား', 'အခုပဲလိုချင်တယ်'],
    promotion: ['ပရိုမိုးရှင်းရှိလား', 'promotion', 'အထူးကမ်းလှမ်းချက်'],
    discount: ['လျှော့စျေးရှိလား', 'discount', 'sale'],
    bestPlan: ['ဘယ် Plan က အကောင်းဆုံးလဲ', 'best plan', 'အကြံပြု'],
    multiplePhones: ['ဖုန်းအများကြီးထည့်လို့ရလား', 'multiple phones', 'ဖုန်းများစွာ'],
    todayReceive: ['ဒီနေ့တင် ရမလား', 'today', 'ယနေ့'],
    whoWorks: ['ဘယ်သူတွေအလုပ်လုပ်လဲ', 'who works', 'team'],
    contact: ['တခြားဘယ်လိုဆက်သွယ်ရမလဲ', 'contact'],
    orderNumber: ['အော်ဒါအမှတ်', 'order number'],
    download: ['ဒေါင်းလုဒ်လုပ်လို့ရလား', 'အက်ပ်ဘယ်မှာရမလဲ', 'APK', 'iPhone ရလား', 'iOS ရလား', 'Android ရလား', 'သူငယ်ချင်းဆီကနေ ရနိုင်မလား', 'မိတ်ဆွေဆီကနေ ယူလို့ရလား'],
    renewal: ['သက်တမ်းတိုးလို့ရလား', 'ဘယ်လိုသက်တမ်းတိုးရလဲ', 'plan သက်တမ်းတိုးချင်တယ်', 'ဒေတာသက်တမ်းတိုး', 'renewal'],
    personalQuestion: ['စားပီးပီးလား', 'နေကောင်းလား', 'ဘာလုပ်နေလဲ', 'သေနေတာလား', 'အိပ်နေပီလား', 'ဘယ်သွားနေတာလဲ', 'ဘာလုပ်နေတာလဲ', 'ဘာစားချင်လဲ', 'ဘာဖြစ်ချင်လဲ', 'ပြောကြည့်လိုက်', 'သေလိုက်', 'ပို့လာခဲ့'],
    rudeWords: ['ငါလိုးမသား', 'လီးလား', 'မင်းမေလိုး', 'မင်းမေစပက်', 'မင်းနှမငါလိုး', 'ကိုမေကိုလိုး', 'kmkl', 'ခွေးမသား', 'သူတောင်းစား', 'မင်းအမေငါလိုး', 'အမောက်စာ', 'မိုက်မဲ', 'အတုံအခဲ', 'shit', 'fuck', 'damn', 'stupid', 'idiot', 'asshole', 'bastard', 'motherfucker', 'dickhead', 'အပြင်ထွက်ချင်လား', 'တွေ့ချင်လား', 'လာတွေ့စမ်း', 'ရှေ့ထွက်ချင်လား', 'ရဲရဲထွက်လား', 'ကြောက်လို့လား', 'fight', 'challenge'],
    respectful: ['ကိုကြီး', 'အကို', 'ကိုကို', 'ကိုယ်တော်', 'ဆရာ', 'ခင်ဗျား', 'ဆရာနေကောင်းလား', 'ဆရာလား', 'ကိုအောင်သူထွေးလား', 'ko aung thu htwe', 'ကို အောင်သူလား', 'ko aung thu'],
    whoAreYou: ['ပြောစရာရှိလို့', 'ကိုကြီးကော ဟုတ်လို့လား', 'အခုက ဘယ်သူလဲ', 'မင်းကဘယ်သူလဲ', 'ဘယ်သူပြောနေတာလဲ'],
    techSupport: ['အက်ပ်မရှိဘူး', 'error ပြနေတယ်', 'ဖုန်းမှာ data မပြ', 'အလုပ်မလုပ်ဘူး', 'မရဘူး'],
    editOrder: ['အော်ဒါပြင်လို့ရလား', 'plan ပြောင်းချင်တယ်', 'order edit'],
    wrongTransfer: ['ငွေလွှဲမှားသွားတယ်', 'wrong transfer', 'လွှဲမှား'],
    serviceDown: ['ဆာဗာပိတ်ထားလား', 'ဘာလို့မရတာလဲ', 'service down'],
    editAccount: ['username ပြောင်းချင်တယ်', 'နာမည်ပြင်ချင်တယ်', 'account edit'],
    approvePayment: ['ငွေလွှဲထားတာ အတည်မပြုရသေးဘူး', 'approve payment'],
    appDownload: ['ဘယ်အက်ပ်သုံးရမလဲ', 'app download', 'apk download'],
    phoneModel: ['iPhone ရော ရမလား', 'iOS ရော', 'Android ပဲရမှာလား'],
    confirmTime: ['ငွေလွှဲအတည်ပြုဖို့ ဘယ်လောက်ကြာမလဲ', 'confirm time'],
    urgentOrder: ['အော်ဒါကို အမြန်ဆုံးလုပ်ပေးပါ', 'urgent order'],
    deleteAccount: ['အကောင့်ပိတ်လို့ရလား', 'account delete', 'အကောင့်ဖျက်မယ်'],
    otherPayment: ['တခြားငွေပေးချေနည်းရှိလား', 'other payment', 'ဘယ်လိုမျိုးပေးလို့ရလဲ'],
    resendOrder: ['အော်ဒါထပ်ပို့လို့ရလား', 'resend order', 'order again'],
    safety: ['လုံခြုံရေးကော', 'is it safe', 'trust', 'ယုံကြည်ရလား'],
    accountVerified: ['အကောင့်အတည်ပြုပြီးပြီလား', 'account verified', 'verify'],
    notifyPromo: ['ပရိုမိုးရှင်းရှိရင် ပြောပါ', 'notify me', 'အသိပေးပါ'],
    exactTime: ['ဘယ်အချိန်မှာရမလဲ', 'exact time', 'တိကျတဲ့အချိန်'],
    latestStatus: ['နောက်ဆုံးအခြေအနေပြောပါ', 'latest status', 'အခုအခြေအနေ']
};

// Get user language preference
function getUserLanguage(userId) {
    if (userLanguages.has(userId)) {
        return userLanguages.get(userId);
    }
    return defaultLanguage;
}

// Set user language preference
function setUserLanguage(userId, language) {
    if (['my', 'en', 'zh'].includes(language)) {
        userLanguages.set(userId, language);
        return true;
    }
    return false;
}

// Get auto reply based on user message, shop status, and language
function getAutoReply(message, isShopOpen, userId = null) {
    const lowerMessage = message.toLowerCase().trim();
    const lang = userId ? getUserLanguage(userId) : defaultLanguage;
    const langData = languages[lang] || languages.my;
    
    // Check each keyword category
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
    
    // No keyword matched - return default
    return isShopOpen ? langData.default.open : langData.default.closed;
}

// Get available languages
function getAvailableLanguages() {
    return Object.keys(languages);
}

module.exports = { 
    getAutoReply, 
    setUserLanguage, 
    getUserLanguage, 
    getAvailableLanguages,
    keywords 
};
