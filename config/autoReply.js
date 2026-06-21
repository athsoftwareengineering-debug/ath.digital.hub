const fs = require('fs');
const path = require('path');

// Load language files
const languages = {
    my: JSON.parse(fs.readFileSync(path.join(__dirname, '../public/languages/my.json'), 'utf8')),
    en: JSON.parse(fs.readFileSync(path.join(__dirname, '../public/languages/en.json'), 'utf8')),
    zh: JSON.parse(fs.readFileSync(path.join(__dirname, '../public/languages/zh.json'), 'utf8'))
};

let defaultLanguage = 'my';
const userLanguages = new Map();

// ==================== KEYWORDS (34 Categories) ====================
const keywords = {
    dataMB: [
        'ဒေတာ ထည့်လို့ရသေးလား', 'mb ထည့်လို့ရသေးလား', 'data', 'mb', 'ဒေတာ',
        'ပလန်ဝယ်လို့ရလား', 'ပလန်ဝယ်လို့ရသေးလား', 'plan ဝယ်လို့ရလား', 'plan ဝယ်လို့ရသေးလား',
        'ဝယ်လို့ရလား', 'အခုဝယ်လို့ရလား'
    ],
    vipPlan: [
        'plan', 'vip', 'အစီအစဉ်', 'စျေး', 'price', 'ဈေးနှုန်း',
        'ဘာပလန်တွေရှိလဲ', 'ဘယ်plan တွေရှိလဲ', 'plan တွေပြောပါ', 'plan စာရင်း',
        'ပလန်တွေရှိလား', 'ဘယ်လိုပလန်တွေရှိလဲ'
    ],
    priceAmount: [
        '15000', '20000', '25000', '30000', 'တစ်သောင်းခွဲ', 'နှစ်သောင်း', 'သုံးသောင်း',
        'ဘယ်လောက်တန်တွေရှိလဲ', 'စျေးနှုန်းဘယ်လောက်ရှိလဲ', 'ဘယ်နှစ်ကျပ်ရှိလဲ',
        'ဘယ်နှစ်သောင်းတန်တွေရှိလဲ', 'plan စျေးနှုန်းတွေ'
    ],
    payment: [
        'ငွေချေနည်း', 'ငွေပေးချေနည်း', 'ငွေဘယ်လိုချေရမလဲ', 'payment',
        'ဘယ်အကောင့်ကိုလွှဲရမလဲ', 'ငွေပေးချေမှု'
    ],
    paymentDetail: [
        'ငွေချေနည်းကို ထပ်ရှင်းပြစမ်းပါ', 'နားမလည်ဘူး', 'အဆင့်ဆင့်ရှင်းပြစမ်းပါ'
    ],
    noScreenshot: [
        'screenshot တင်လို့မရဘူး', 'နှိပ်လို့မရဘူး', 'ဓာတ်ပုံတင်လို့မရဘူး'
    ],
    giftPurchase: [
        'အခြားသူအတွက်ဝယ်ပေးလို့ရလား', 'လက်ဆောင်ဝယ်ပေးလို့ရလား'
    ],
    orderStatus: [
        'ဒေတာ ထည့်ပြီးပြီလား', 'အော်ဒါရောက်ပြီလား'
    ],
    orderLate: [
        'ဒေတာ ဝယ်ထားတာ ကြာလှနေပြီ', 'အော်ဒါမရောက်သေးဘူး'
    ],
    transferStatus: [
        'ငွေလွှဲတာရောက်လား', 'ငွေလွှဲပြီးပြီလား', 'ငွေရောက်ပြီလား'
    ],
    howToBuy: [
        'ဘယ်အချိန်ထိ ဝယ်လို့ရလဲ', 'ဘယ်လိုဝယ်ရလဲ', 'ဝယ်ယူနည်းအဆင့်ဆင့်',
        'ဘယ်လိုဝယ်ရမလဲ', 'ဝယ်ယူနည်း', 'ဘယ်လိုမှာယူရမလဲ'
    ],
    howToCheck: [
        'ရောက်မရောက် ဘယ်လိုစစ်ရမလဲ', 'အော်ဒါအခြေအနေ ဘယ်လိုစစ်ရမလဲ'
    ],
    accountIssue: [
        'အကောင့်ဝင်လို့မရဘူး', 'ဖုန်းနံပါတ်မေ့သွားတယ်', 'user id မေ့သွားတယ်'
    ],
    help: [
        'help', 'အကူအညီ', 'ကူညီ', 'guide', 'လမ်းညွှန်'
    ],
    greeting: [
        'hi', 'hello', 'မင်္ဂလာပါ', 'ဟိုင်း', 'hey'
    ],
    serviceHours: [
        'ဘယ်အချိန်ဖွင့်လဲ', 'ဆိုင်ဖွင့်ချိန်', 'service hours',
        'ဆိုင်ပိတ်တယ်', 'ခဏ'
    ],
    checkDataBalance: [
        'ဒေတာလက်ကျန်စစ်လို့ရလား', 'ဒေတာဘယ်လောက်ကျန်သေးလဲ', 'ဒေတာ ဘယ်လောက်ကျန်သေးလဲ',
        'ဘယ်လိုစစ်ရမလဲ', 'မိနစ်ဘယ်လောက်ကျန်သေးလဲ', 'mb ဘယ်လောက်ကျန်သေးလဲ',
        'လက်ကျန်စစ်မယ်', 'data balance', 'ဒေတာကျန်သေးလား', 'balance check'
    ],
    personalQuestion: [
        'ကိုရီးက ကောင်မလေးရှိလား', 'ရည်းစားရှိလား', 'မိန်းမရှိလား', 'ချစ်သူရှိလား',
        'ဘာလုပ်နေလဲ', 'တစ်ယောက်ထဲနေတာလား', 'အလုပ်ရှုပ်နေလား', 'အနှောက်အယှက်ဖြစ်နေလား',
        'ဘာစားပြီးပြီလဲ', 'စားပြီးပြီလား', 'နေကောင်းလား', 'ဘယ်မှာနေတာလဲ',
        'ဘာတွေလုပ်နေတာလဲ', 'အိပ်နေတာလား', 'ဘာစားချင်လဲ', 'နေရတာ ပျင်းလား',
        'ဘာအလုပ်လုပ်လဲ', 'ဘယ်မှာအလုပ်လုပ်လဲ', 'ဘယ်နှစ်နှစ်လဲ', 'အသက်ဘယ်လောက်လဲ',
        'မိဘတွေရှိလား', 'မောင်နှမရှိလား', 'အိမ်ထောင်ရှိလား', 'သားသမီးရှိလား',
        'ကိုကြီးကလစာဘယ်လောက်ရတာလဲ', 'ကိုရီးကလစာကောင်းလား',
        'လစာဘယ်လောက်ရလဲ', 'ဘယ်လောက်တန်လဲ',
        'ဒီမှာ လုပ်ရတာမပျော်တော့ဘူး', 'ဒီမှာမလုပ်ချင်တော့ဘူး',
        'ဒီစက်ရုံမှာ မလုပ်ချင်တော့ဘူး', 'အလုပ်ထွက်မယ်'
    ],
    respectful: [
        'ကိုကြီး', 'ကိုကို', 'အကို', 'မောင်လေး', 'ဆရာ', 'ခင်ဗျား'
    ],
    rudeWords: [
        'စပ', 'စပပဲ', 'စပဘဲ', 'လီးတွေဖြေနေ', 'ကိုမေကိုလိုး', 'စပစား', 'နှမလိုး',
        'ခွေးသူတောင်းစား', 'သူတောင်းစား', 'လီးလား', 'စပလား', 'fuck', 'shit', 'damn',
        'ငါလိုးမသား', 'မင်းမေလိုး', 'ခွေးမသား'
    ],
    healthQuestion: [
        'ငါနေမကောင်းဘူး', 'အိပ်မပျော်ဘူး', 'အပျင်းကြီးတယ်', 'ဘာလုပ်ရမလဲ',
        'ငါတစ်ခုခုစားချင်တယ်', 'ဟော့ပေါ့စားချင်တယ်'
    ],
    howToBuyPackage: [
        'package ဘယ်လိုဝယ်လို့ရလဲ', 'pg ဘယ်လိုဝယ်ရမလဲ',
        'ပက်ကေ့ချ်ဘယ်လိုဝယ်ရမလဲ'
    ],
    packageList: [
        'ဘာ ပက်ကေ့တွေရှိလဲ', 'ဘယ်လိုပက်ကေ့ချ်တွေရှိလဲ',
        'ပက်ကေ့ချ်စာရင်း', 'package list'
    ],
    newUser: [
        'အခုမှစသုံးဖူးတာ', 'အခုမှစသုံးမှာ', 'ပထမဆုံးအကြိမ်',
        'အသစ်သုံးမယ်', 'စသုံးတော့မယ်'
    ],
    whatIsThis: [
        'ဒါက ဘာဆော့ဝဲလဲ', 'ဒါဘာလဲ', 'what is this',
        'ဒီ website က ဘာလဲ', 'ဘာအလုပ်လုပ်တာလဲ'
    ],
    howToUploadSlip: [
        'ပြေစာဘယ်လိုတင်လို့ရလဲ', 'ဘယ်လိုတင်ရလဲ',
        'ပြေစာတင်နည်း', 'ငွေလွှဲပြေစာဘယ်လိုတင်ရမလဲ',
        'screenshot ဘယ်လိုတင်ရမလဲ', 'ဓာတ်ပုံဘယ်လိုတင်ရမလဲ'
    ],
    receiptLastDigits: [
        'ပြေစာကနောက်ဆုံးနံပါတ်က ဘယ်ဟာကိုပြောတာလဲ',
        'နောက်ဆုံးနံပါတ်', 'ပြေစာနောက်ဆုံးဂဏန်း',
        'ဘယ်နံပါတ်ကိုထည့်ရမလဲ', 'နောက်ဆုံးဂဏန်းဘယ်လောက်ထည့်ရမလဲ'
    ],
    aboutATH: [
        'အေတီအိတ်ချ်', 'ATH', 'ATH DIGITAL HUB', 'ath',
        'ဘာကိုပြောတာလဲ', 'ဘာအဓိပ္ပါယ်လဲ', 'ဘာနံမည်လဲ',
        'ath ဆိုတာဘာလဲ', 'ဘယ်လိုကြောင့်ဒီနံမည်ပေးတာလဲ'
    ],
    howToRenew: [
        'ဘယ်လိုသက်တမ်းတိုးရမလဲ', 'သက်တမ်းတိုးနည်း', 'renew', 'ထပ်ဝယ်ရမလဲ',
        'ဘယ်လိုထပ်ဝယ်ရမလဲ', 'plan ထပ်ဝယ်ရမလဲ'
    ],
    howManyDays: [
        'ဘယ်နှစ်ရက်သုံးလို့ရလဲ', 'ဘယ်လောက်ကြာကြာခံလဲ', 'ဘယ်နှစ်ရက်ခံလဲ',
        'ဘယ်လောက်ကြာမလဲ', 'ရက်ဘယ်လောက်လဲ', 'သက်တမ်းဘယ်လောက်လဲ'
    ],
    whatCanUse: [
        'ဘာတွေသုံးလို့ရလဲ', 'ဘာအတွက်သုံးလို့ရလဲ', 'ဘာတွေပါလဲ',
        'ဘာအကျိုးခံစားရမလဲ', 'ဘာတွေရနိုင်လဲ'
    ],
    whatTimeToBuy: [
        'ဘယ်ချိန်ဝယ်လို့ရလဲ', 'ဘယ်အချိန်ဝယ်လို့ရလဲ', 'ဘယ်အချိန်ထိဝယ်လို့ရလဲ',
        'ဘယ်အချိန်မှာဝယ်လို့ရလဲ', 'ဘယ်အချိန်ရောင်းလဲ'
    ],
    whatAvailable: [
        'ဘာတွေရှိလဲ', 'ဘာတွေရောင်းလဲ', 'ဘယ်လိုဝန်ဆောင်မှုတွေရှိလဲ',
        'ဘာတွေရနေလဲ', 'ဘာတွေလုပ်ပေးလဲ'
    ],
    howToReply: [
        'မင်းဘယ်လိုဖြေမလဲ', 'ဘယ်လိုဖြေမလဲ', 'ဘယ်လိုအလုပ်လုပ်လဲ',
        'how do you reply', 'how it works', 'စနစ်အလုပ်လုပ်ပုံ'
    ]
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
