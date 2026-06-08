const fs = require('fs');
const path = require('path');

// ==================== LOAD LANGUAGE FILES ====================
const languages = {
    my: JSON.parse(fs.readFileSync(path.join(__dirname, 'languages/my.json'), 'utf8')),
    en: JSON.parse(fs.readFileSync(path.join(__dirname, 'languages/en.json'), 'utf8')),
    zh: JSON.parse(fs.readFileSync(path.join(__dirname, 'languages/zh.json'), 'utf8'))
};

// ==================== CONFIGURATION ====================
let defaultLanguage = 'my';
const userLanguages = new Map();

// ==================== KEYWORDS (Language Independent) ====================
const keywords = {
    // 1. Data/MB ထည့်သွင်းခြင်း
    dataMB: ['ဒေတာ ထည့်လို့ရသေးလား', 'mb ထည့်လို့ရသေးလား', 'data ထည့်လို့ရသေးလား', 'ဒေတာထည့်လို့ရသေးလား', 'data', 'mb', 'ဒေတာ'],
    
    // 2. VIP Plan များ
    vipPlan: ['plan', 'vip', 'အစီအစဉ်', 'စျေး', 'price', 'ဈေးနှုန်း'],
    
    // 3. ပမာဏအလိုက် Data/MB
    priceAmount: ['15000', '20000', '25000', '30000', '၁၅၀၀၀', '၂၀၀၀၀', '၂၅၀၀၀', '၃၀၀၀၀', 'တစ်သောင်းခွဲ', 'နှစ်သောင်း', 'နှစ်သောင်းခွဲ', 'သုံးသောင်း'],
    
    // 4. ငွေပေးချေနည်း
    payment: ['ငွေချေနည်း', 'ငွေပေးချေနည်း', 'ငွေဘယ်လိုချေရမလဲ', 'ငွေဘယ်လိုပေးရမလဲ', 'payment', 'ငွေရှင်းနည်း'],
    
    // 5. ငွေချေနည်း ထပ်ရှင်းပြချက်
    paymentDetail: ['ငွေချေနည်းကို ထပ်ရှင်းပြစမ်းပါ', 'ထပ်ရှင်းပြပါ', 'နားမလည်ဘူး', 'အဆင့်ဆင့်ရှင်းပြစမ်းပါ'],
    
    // 6. Screenshot မရပါက
    noScreenshot: ['screenshot တင်လို့မရဘူး', 'နှိပ်လို့မရဘူး', 'ဓာတ်ပုံတင်လို့မရဘူး', 'ပုံမတင်နိုင်ဘူး'],
    
    // 7. ဘေဝယ်လို့ရလား
    shopPurchase: ['ဘေဝယ်လို့ရလား', 'ဆိုင်သွားဝယ်လို့ရလား', 'လာဝယ်လို့ရလား'],
    
    // 8. အခြားသူအတွက်ဝယ်ပေးခြင်း
    giftPurchase: ['အခြားသူအတွက်ဝယ်ပေးလို့ရလား', 'ဖုန်းနောက်တစ်လုံးနဲ့ဝယ်လို့ရလား', 'သူများဖုန်းကိုဝယ်ပေးလို့ရလား', 'လက်ဆောင်ဝယ်ပေးလို့ရလား'],
    
    // 9. နှုတ်ခွန်းဆက်
    greeting: ['hi', 'hello', 'မင်္ဂလာပါ', 'ဟိုင်း', 'ဟယ်လို'],
    
    // 10. အကူအညီ
    help: ['help', 'အကူအညီ', 'ကူညီ', 'အကူအညီလိုတယ်'],
    
    // 11. အကောင့်ပြဿနာ
    accountIssue: ['အကောင့်ဝင်လို့မရဘူး', 'ဖုန်းနံပါတ်မေ့သွားတယ်', 'login မဝင်နိုင်ဘူး', 'user id မေ့သွားတယ်', 'အကောင့်ပျောက်သွားတယ်', 'username မေ့သွားတယ်'],
    
    // 12. အော်ဒါရောက်/မရောက်
    orderStatus: ['ဒေတာ ထည့်ပြီးပြီလား', 'mb ထည့်ပြီးပြီလား', 'data ထည့်ပြီးပြီလား', 'အော်ဒါရောက်ပြီလား', 'ကျွန်တော့်အော်ဒါ ရောက်ပြီလား'],
    
    // 13. အော်ဒါကြာလှပြီ
    orderLate: ['ဒေတာ ဝယ်ထားတာ ကြာလှနေပြီ', 'ကြာလှနေပြီ မရောက်သေးဘူး', 'အော်ဒါမရောက်သေးဘူး', 'ဝယ်ထားတာ ကြာပြီ'],
    
    // 14. ငွေလွှဲရောက်/မရောက်
    transferStatus: ['ငွေလွှဲတာရောက်လား', 'ငွေလွှဲပြီးပြီလား', 'ငွေရောက်ပြီလား', 'ငွေလွှဲထားတယ် ရောက်ပြီလား'],
    
    // 15. ထုတ်ကုန်စာရင်း
    productList: ['နောက်ထပ် ဘာတွေရောင်းသေးလဲ', 'ဘာတွေရောင်းလဲ', 'ထုတ်ကုန်တွေဘာတွေရှိလဲ', 'ဘာတွေထပ်ရှိသေးလဲ', 'တခြားဘာရသေးလဲ'],
    
    // 16. ဝယ်ရင်ဘယ်လောက်ကြာ
    howLong: ['ဒေတာဝယ်ရင် ဘယ်လောက်ကြာလဲ', 'mb ဝယ်ရင် ဘယ်လောက်ကြာမလဲ', 'ဝယ်ပြီးရင် ဘယ်နှစ်မိနစ်ကြာမလဲ'],
    
    // 17. စစ်ဆေးနည်း
    howToCheck: ['ရောက်မရောက် ဘယ်လိုစစ်ရမလဲ', 'အော်ဒါအခြေအနေ ဘယ်လိုစစ်ရမလဲ', 'ဘယ်လိုစစ်ကြည့်ရမလဲ'],
    
    // 18. အသေးစိတ်ရှင်းပြပါ
    explainDetail: ['အသေးစိတ်ရှင်းပြပါ', 'အသေးစိတ်ပြောပြပါ', 'ရှင်းပြပေးပါ', 'အသေးစိတ်သိချင်တယ်'],
    
    // 19. ဘယ်အချိန်ထိဝယ်လို့ရလဲ / ဘယ်လိုဝယ်ရလဲ
    howToBuy: ['ဘယ်အချိန်ထိ ဝယ်လို့ရလဲ', 'ဘယ်လိုဝယ်ရလဲ', 'ဘယ်လိုမျိုးဝယ်ယူရမလဲ', 'ဝယ်ယူနည်းအဆင့်ဆင့်', 'ဘယ်အချိန်အထိရလဲ'],
    
    // 20. ကျေးဇူးပါ
    thankYou: ['ကျေးဇူးပါ', 'ကျေးဇူးတင်ပါတယ်', 'thanks', 'thank you'],
    
    // 21. အော်ဒါဖျက်လို့ရလား / ငွေပြန်အမ်းလို့ရလား
    cancelOrder: ['အော်ဒါဖျက်လို့ရလား', 'order cancel', 'ဖျက်သိမ်းလို့ရလား', 'ငွေပြန်အမ်းလို့ရလား', 'refund', 'ငွေပြန်အမ်းလား', 'ငွေပြန်အမ်းပေးလား', 'ပိုက်ဆံပြန်ပေးလား', 'ငွေပြန်ပေးလား'],
    
    // 22. တိုင်ကြားချက် / အကြံပြုချက်
    complaint: ['တိုင်ကြားချင်တယ်', 'complaint', 'မကျေနပ်ဘူး', 'အကြံပြု', 'suggestion', 'ဝန်ဆောင်မှုမကျေနပ်ဘူး'],
    
    // 23. အကောင့်အသစ်ဖွင့်ခြင်း
    newAccount: ['အကောင့်အသစ်ဖွင့်', 'အသစ်ဖွင့်', 'new account', 'register', 'sign up'],
    
    // 24. အော်ဒါမှတ်တမ်း
    orderHistory: ['အော်ဒါမှတ်တမ်း', 'order history', 'ဝယ်ခဲ့ဖူးတာ', 'အရင်အမိန့်စာ'],
    
    // 25. ဝန်ဆောင်မှုအချိန်
    serviceHours: ['ဘယ်အချိန်ဖွင့်လဲ', 'ဆိုင်ဖွင့်ချိန်', 'ဝန်ဆောင်မှုချိန်', 'service hours'],
    
    // 26. အကြောင်းပြန်ချိန်
    responseTime: ['ပြန်ဖြေဖို့ဘယ်လောက်ကြာမလဲ', 'response time', 'ပြန်စာကြာ'],
    
    // 27. ငွေလွှဲအကောင့်အမည်
    accountName: ['ဘယ်အကောင့်ကိုလွှဲရမလဲ', 'account name', 'အကောင့်နာမည်'],
    
    // 28. အခုချက်ချင်းရလား
    nowImmediately: ['အခုချက်ချင်းရလား', 'အခုရလား', 'အခုထည့်ပေးလို့ရလား', 'ချက်ချင်းရနိုင်မလား', 'အခုပဲလိုချင်တယ်'],
    
    // 29. ပရိုမိုးရှင်း
    promotion: ['ပရိုမိုးရှင်းရှိလား', 'promotion', 'အထူးကမ်းလှမ်းချက်'],
    
    // 30. လျှော့စျေး
    discount: ['လျှော့စျေးရှိလား', 'discount', 'sale'],
    
    // 31. အကောင်းဆုံး Plan
    bestPlan: ['ဘယ် Plan က အကောင်းဆုံးလဲ', 'best plan', 'အကြံပြု'],
    
    // 32. ဖုန်းများစွာ
    multiplePhones: ['ဖုန်းအများကြီးထည့်လို့ရလား', 'multiple phones', 'ဖုန်းများစွာ'],
    
    // 33. ယနေ့ရမလား
    todayReceive: ['ဒီနေ့တင် ရမလား', 'today', 'ယနေ့'],
    
    // 34. အလုပ်လုပ်သူများ
    whoWorks: ['ဘယ်သူတွေအလုပ်လုပ်လဲ', 'who works', 'team'],
    
    // 35. ဆက်သွယ်ရန်
    contact: ['တခြားဘယ်လိုဆက်သွယ်ရမလဲ', 'contact'],
    
    // 36. အော်ဒါအမှတ်
    orderNumber: ['အော်ဒါအမှတ်', 'order number'],
    
    // 37. ဒေါင်းလုဒ် / ဖုန်းမော်ဒယ်
    download: ['ဒေါင်းလုဒ်လုပ်လို့ရလား', 'အက်ပ်ဘယ်မှာရမလဲ', 'APK', 'iPhone ရလား', 'iOS ရလား', 'Android ရလား', 'သူငယ်ချင်းဆီကနေ ရနိုင်မလား', 'မိတ်ဆွေဆီကနေ ယူလို့ရလား'],
    
    // 38. သက်တမ်းတိုးခြင်း
    renewal: ['သက်တမ်းတိုးလို့ရလား', 'ဘယ်လိုသက်တမ်းတိုးရလဲ', 'plan သက်တမ်းတိုးချင်တယ်', 'ဒေတာသက်တမ်းတိုး', 'renewal'],
    
    // 39. ပုဂ္ဂိုလ်ရေးမေးခွန်းများ
    personalQuestion: ['စားပီးပီးလား', 'နေကောင်းလား', 'ဘာလုပ်နေလဲ', 'သေနေတာလား', 'အိပ်နေပီလား', 'ဘယ်သွားနေတာလဲ', 'ဘာလုပ်နေတာလဲ', 'ဘာစားချင်လဲ', 'ဘာဖြစ်ချင်လဲ', 'ပြောကြည့်လိုက်', 'သေလိုက်', 'ပို့လာခဲ့'],
    
    // 40. စကားရိုင်းများ (ဆဲဆိုခြင်း)
    rudeWords: ['ငါလိုးမသား', 'လီးလား', 'မင်းမေလိုး', 'မင်းမေစပက်', 'မင်းနှမငါလိုး', 'ကိုမေကိုလိုး', 'kmkl', 'ခွေးမသား', 'သူတောင်းစား', 'မင်းအမေငါလိုး', 'အမောက်စာ', 'မိုက်မဲ', 'အတုံအခဲ', 'shit', 'fuck', 'damn', 'stupid', 'idiot', 'asshole', 'bastard', 'motherfucker', 'dickhead', 'အပြင်ထွက်ချင်လား', 'တွေ့ချင်လား', 'လာတွေ့စမ်း', 'ရှေ့ထွက်ချင်လား', 'ရဲရဲထွက်လား', 'ကြောက်လို့လား', 'fight', 'challenge', 'မသာ', 'မသာကောင်', 'သေချင်းစိုး', 'အမဲခြောက်', 'မသာဘူး', 'သေချင်လိုက်တာ'],
    
    // 41. ရိုသေလေးစားစွာခေါ်ဝေါ်ခြင်း
    respectful: ['ကိုကြီး', 'အကို', 'ကိုကို', 'ကိုယ်တော်', 'ဆရာ', 'ခင်ဗျား', 'ဆရာနေကောင်းလား', 'ဆရာလား', 'ကိုအောင်သူထွေးလား', 'ko aung thu htwe', 'ကို အောင်သူလား', 'ko aung thu'],
    
    // 42. သင်ဘယ်သူလဲ
    whoAreYou: ['ပြောစရာရှိလို့', 'ကိုကြီးကော ဟုတ်လို့လား', 'အခုက ဘယ်သူလဲ', 'မင်းကဘယ်သူလဲ', 'ဘယ်သူပြောနေတာလဲ'],
    
    // 43. နည်းပညာအကူအညီ
    techSupport: ['အက်ပ်မရှိဘူး', 'error ပြနေတယ်', 'ဖုန်းမှာ data မပြ', 'အလုပ်မလုပ်ဘူး', 'မရဘူး'],
    
    // 44. အော်ဒါပြင်ဆင်ခြင်း
    editOrder: ['အော်ဒါပြင်လို့ရလား', 'plan ပြောင်းချင်တယ်', 'order edit'],
    
    // 45. ငွေလွှဲမှားခြင်း
    wrongTransfer: ['ငွေလွှဲမှားသွားတယ်', 'wrong transfer', 'လွှဲမှား'],
    
    // 46. ဝန်ဆောင်မှုရပ်နားချိန်
    serviceDown: ['ဆာဗာပိတ်ထားလား', 'ဘာလို့မရတာလဲ', 'service down'],
    
    // 47. အကောင့်အချက်အလက်ပြင်ဆင်ခြင်း
    editAccount: ['username ပြောင်းချင်တယ်', 'နာမည်ပြင်ချင်တယ်', 'account edit'],
    
    // 48. ငွေလွှဲအတည်ပြုရန်သတိပေး
    approvePayment: ['ငွေလွှဲထားတာ အတည်မပြုရသေးဘူး', 'approve payment'],
    
    // 49. အက်ပ်ဒေါင်းလုဒ်
    appDownload: ['ဘယ်အက်ပ်သုံးရမလဲ', 'app download', 'apk download'],
    
    // 50. ဖုန်းမော်ဒယ်အလိုက်
    phoneModel: ['iPhone ရော ရမလား', 'iOS ရော', 'Android ပဲရမှာလား'],
    
    // 51. ငွေလွှဲအတည်ပြုရန်အချိန်
    confirmTime: ['ငွေလွှဲအတည်ပြုဖို့ ဘယ်လောက်ကြာမလဲ', 'confirm time'],
    
    // 52. အော်ဒါထပ်မံဆောင်ရွက်ရန်
    urgentOrder: ['အော်ဒါကို အမြန်ဆုံးလုပ်ပေးပါ', 'urgent order'],
    
    // 53. အကောင့်ပိတ်ခြင်း
    deleteAccount: ['အကောင့်ပိတ်လို့ရလား', 'account delete', 'အကောင့်ဖျက်မယ်'],
    
    // 54. အခြားငွေပေးချေနည်း
    otherPayment: ['တခြားငွေပေးချေနည်းရှိလား', 'other payment', 'ဘယ်လိုမျိုးပေးလို့ရလဲ'],
    
    // 55. အော်ဒါထပ်မံပို့ရန်
    resendOrder: ['အော်ဒါထပ်ပို့လို့ရလား', 'resend order', 'order again'],
    
    // 56. ဘေးကင်းရေး
    safety: ['လုံခြုံရေးကော', 'is it safe', 'trust', 'ယုံကြည်ရလား'],
    
    // 57. အကောင့်အတည်ပြု
    accountVerified: ['အကောင့်အတည်ပြုပြီးပြီလား', 'account verified', 'verify'],
    
    // 58. ပရိုမိုးရှင်းအကြောင်းကြားရန်
    notifyPromo: ['ပရိုမိုးရှင်းရှိရင် ပြောပါ', 'notify me', 'အသိပေးပါ'],
    
    // 59. အချိန်ဇယား
    exactTime: ['ဘယ်အချိန်မှာရမလဲ', 'exact time', 'တိကျတဲ့အချိန်'],
    
    // 60. နောက်ဆုံးအခြေအနေ
    latestStatus: ['နောက်ဆုံးအခြေအနေပြောပါ', 'latest status', 'အခုအခြေအနေ']
};

// ==================== HELPER FUNCTIONS ====================

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

// ==================== EXPORTS ====================
module.exports = { 
    getAutoReply, 
    setUserLanguage, 
    getUserLanguage, 
    getAvailableLanguages,
    keywords
};
