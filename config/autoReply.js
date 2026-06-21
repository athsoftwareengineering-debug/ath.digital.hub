// config/autoReply.js

const fs = require('fs');
const path = require('path');

// ============ LANGUAGE FILES WITH FALLBACK ============
function loadLanguageFile(lang) {
    try {
        const filePath = path.join(__dirname, '../public/languages', `${lang}.json`);
        if (fs.existsSync(filePath)) {
            console.log(`✅ Loading ${lang}.json from: ${filePath}`);
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
        console.warn(`⚠️ Language file not found: ${lang}.json, using fallback`);
    } catch (e) {
        console.error(`Error loading ${lang}.json:`, e.message);
    }
    return null;
}

// ============ FALLBACK LANGUAGE DATA (ဖိုင်မရှိရင် သုံးဖို့) ============
const FALLBACK_DATA = {
    my: {
        "greeting": {
            "open": "👋 မင်္ဂလာပါခင်ဗျာ။ ATH DIGITAL HUB မှ ကြိုဆိုပါတယ်။\n\nဘယ်လိုကူညီနိုင်မလဲခင်ဗျာ။\n\n✨ ATH DIGITAL HUB",
            "closed": "👋 မင်္ဂလာပါခင်ဗျာ။\n\n⏰ ယခု ဆိုင်ပိတ်ချိန်ဖြစ်ပါသည်။\n⏰ ဆိုင်ဖွင့်ချိန်: နံနက် ၉:၀၀ မှ ညနေ ၇:၀၀\n\n✨ ATH DIGITAL HUB"
        },
        "dataMB": {
            "open": "✅ ရပါတယ်ခင်ဗျာ။ ချက်ချင်းဝယ်ယူလို့ရပါတယ်။\n\n🛒 **ဝယ်ယူနည်း**\n၁. Plan Tab မှာ လိုချင်တဲ့ Plan ကိုရွေးပါ\n၂. ငွေပေးချေပါ\n၃. Screenshot (သို့) စာသားဖြင့် အတည်ပြုပါ\n\n✨ ATH DIGITAL HUB",
            "closed": "✅ ရပါတယ်ခင်ဗျာ။\n\n⏰ သို့သော် ယခု ဆိုင်ပိတ်ချိန်ဖြစ်ပါသည်။\n⏰ ဆိုင်ဖွင့်ချိန်: နံနက် ၉:၀၀ မှ ညနေ ၇:၀၀\n\nနံနက် ၉:၀၀ နောက်ပိုင်းမှ ပြန်လည်ဝယ်ယူနိုင်ပါမည်။\n\n✨ ATH DIGITAL HUB"
        },
        "vipPlan": {
            "open": "📱 ATH DIGITAL HUB မှာ အောက်ပါ VIP Plan များ ရရှိနိုင်ပါတယ်။\n\n🔥 **VIP LEVEL - 1** - 15,000 MMK\n   • 22 GB\n   • 8000 မိနစ်\n   • 5000 မက်ဆေ့ချ်\n\n⭐ **VIP LEVEL - 2** - 20,000 MMK\n   • 40 GB\n   • 250 မိနစ် (ON-NET)\n\n💎 **VIP LEVEL - 3** - 25,000 MMK\n   • 40 GB\n   • 1400 မိနစ် (ON-NET)\n   • 8000 မက်ဆေ့ချ်\n\n👑 **VIP LEVEL - 4 (ULTRA)** - 30,000 MMK\n   • 120 GB\n\n✨ ATH DIGITAL HUB",
            "closed": "📱 VIP Plan များ ရရှိနိုင်ပါတယ်။\n\n• VIP 1: 15,000 MMK (22 GB)\n• VIP 2: 20,000 MMK (40 GB)\n• VIP 3: 25,000 MMK (40 GB)\n• VIP 4: 30,000 MMK (120 GB)\n\n⏰ ယခု ဆိုင်ပိတ်ချိန်ဖြစ်ပါသည်။\nနံနက် ၉:၀၀ နောက်ပိုင်းမှ ပြန်လည်ဆက်သွယ်ပါ။\n\n✨ ATH DIGITAL HUB"
        },
        "payment": {
            "open": "💳 **ငွေပေးချေနည်းလမ်း ၂ မျိုး**\n\n📸 **နည်းလမ်း ၁ - Screenshot**\n၁. အောက်ပါအကောင့်များသို့ ငွေလွှဲပါ\n၂. Screenshot ရိုက်ပါ\n၃. အော်ဒါတင်ရာတွင် ပုံရွေးချယ်တင်ပါ\n\n✏️ **နည်းလမ်း ၂ - စာသား (Screenshot မရပါက)**\n၁. ငွေလွှဲသူအမည်\n၂. ပြေစာအမှတ် နောက်ဆုံး ၅ လုံး\n၃. ဒေတာထည့်မည့်ဖုန်းနံပါတ်\n\n🏦 **အကောင့်များ:**\n• KBZ Pay: 09789999368 (AUNG THU HTWE)\n• WavePay: 09789999368 (AUNG THU HTWE)\n• AYA Pay: 09789999368 (AUNG THU HTWE)\n\n✨ ATH DIGITAL HUB",
            "closed": "💳 ငွေပေးချေနည်း: KBZ Pay / WavePay / AYA Pay\n📞 09789999368 (AUNG THU HTWE)\n\n⏰ ယခု ဆိုင်ပိတ်ချိန်ဖြစ်ပါသည်။\n\n✨ ATH DIGITAL HUB"
        },
        "help": {
            "open": "🆘 **ATH DIGITAL HUB အကူအညီစာရင်း**\n\n📌 **VIP Plan များ** → \"ဘာ plan တွေရှိလဲ\"\n📌 **ငွေပေးချေနည်း** → \"ငွေဘယ်လိုပေးရမလဲ\"\n📌 **အော်ဒါအခြေအနေ** → \"အော်ဒါရောက်ပြီလား\"\n📌 **ဝယ်ယူနည်း** → \"ဘယ်လိုဝယ်ရမလဲ\"\n📌 **ဆိုင်ဖွင့်ချိန်** → \"ဆိုင်ဘယ်အချိန်ဖွင့်လဲ\"\n\n📞 **ဆက်သွယ်ရန်:** 09789999368 | t.me/ATHsupport\n\n✨ ATH DIGITAL HUB",
            "closed": "🆘 **အကူအညီစာရင်း**\n\n⏰ ယခု ဆိုင်ပိတ်ချိန်ဖြစ်ပါသည်။\n⏰ ဆိုင်ဖွင့်ချိန်: နံနက် ၉:၀၀ မှ ညနေ ၇:၀၀\n\n📞 ဆက်သွယ်ရန်: 09789999368 | t.me/ATHsupport\n\n✨ ATH DIGITAL HUB"
        },
        "orderStatus": {
            "open": "📋 **အော်ဒါအခြေအနေ**\n\nသင့်အော်ဒါကို \"My Orders\" Tab မှာ ဝင်ရောက်ကြည့်ရှုနိုင်ပါတယ်။\n\n• ⏳ Pending - စောင့်ဆိုင်းဆဲ\n• ✅ Approved - အတည်ပြုပြီး\n• ❌ Rejected - ပယ်ချခံရ\n\n✨ ATH DIGITAL HUB",
            "closed": "📋 အော်ဒါအခြေအနေကို နံနက် ၉:၀၀ နောက်ပိုင်းမှ ပြန်လည်စစ်ဆေးပေးပါမည်။\n\n✨ ATH DIGITAL HUB"
        },
        "serviceHours": {
            "open": "⏰ **ဆိုင်ဖွင့်/ပိတ်ချိန်**\n\n🟢 **ဆိုင်ဖွင့်ချိန်:** နံနက် ၉:၀၀\n🔴 **ဆိုင်ပိတ်ချိန်:** ညနေ ၇:၀၀\n\n📌 ယခု ဆိုင်ဖွင့်ချိန်အတွင်း ဖြစ်ပါသည်။\n\n✨ ATH DIGITAL HUB",
            "closed": "⏰ **ဆိုင်ဖွင့်/ပိတ်ချိန်**\n\n🟢 **ဆိုင်ဖွင့်ချိန်:** နံနက် ၉:၀၀\n🔴 **ဆိုင်ပိတ်ချိန်:** ညနေ ၇:၀၀\n\n⏰ ယခု ဆိုင်ပိတ်ချိန်ဖြစ်ပါသည်။\n\n✨ ATH DIGITAL HUB"
        },
        "default": {
            "open": "🙏 ကျေးဇူးတင်ပါသည်။ သင့်စာကို လက်ခံရရှိပါပြီ။\n\n✅ ယခု ဆိုင်ဖွင့်ချိန်ဖြစ်ပါသည်။\nကျွန်ုပ်တို့၏ Admin မှ မကြာမီ ပြန်လည်ဖြေကြားပါမည်။\n\nအမြန်ဖြေကြားချင်ပါက \"help\" ဟု ရိုက်ထည့်ပါ။\n\n✨ ATH DIGITAL HUB",
            "closed": "🙏 ကျေးဇူးတင်ပါသည်။ သင့်စာကို လက်ခံရရှိပါပြီ။\n\n⏰ ယခု ဆိုင်ပိတ်ချိန်ဖြစ်ပါသည်။\n⏰ ဆိုင်ဖွင့်ချိန်: နံနက် ၉:၀၀ မှ ညနေ ၇:၀၀\n\nနံနက် ၉:၀၀ နောက်ပိုင်းမှ ပြန်လည်ဖြေကြားပေးပါမည်။\n\n✨ ATH DIGITAL HUB"
        }
    },
    en: {
        "greeting": {
            "open": "👋 Hello! Welcome to ATH DIGITAL HUB.\n\nHow can I help you?\n\n✨ ATH DIGITAL HUB",
            "closed": "👋 Hello!\n\n⏰ Shop is currently closed.\n⏰ Opening hours: 9:00 AM to 7:00 PM\n\n✨ ATH DIGITAL HUB"
        },
        "dataMB": {
            "open": "✅ Yes, you can. You can purchase immediately.\n\n🛒 **How to buy:**\n1. Go to Plans Tab\n2. Choose your desired Plan\n3. Make payment\n4. Confirm with screenshot or text\n\n✨ ATH DIGITAL HUB",
            "closed": "✅ Yes, you can.\n\n⏰ Shop is currently closed.\n⏰ Opening hours: 9:00 AM to 7:00 PM\n\nPlease come back during opening hours.\n\n✨ ATH DIGITAL HUB"
        },
        "vipPlan": {
            "open": "📱 The following VIP Plans are available:\n\n🔥 **VIP LEVEL - 1** - 15,000 MMK\n   • 22 GB\n   • 8000 MINS\n   • 5000 SMS\n\n⭐ **VIP LEVEL - 2** - 20,000 MMK\n   • 40 GB\n   • 250 ON-NET MINS\n\n💎 **VIP LEVEL - 3** - 25,000 MMK\n   • 40 GB\n   • 1400 ON-NET MINS\n   • 8000 SMS\n\n👑 **VIP LEVEL - 4 (ULTRA)** - 30,000 MMK\n   • 120 GB\n\n✨ ATH DIGITAL HUB",
            "closed": "📱 VIP Plans available:\n\n• VIP 1: 15,000 MMK (22 GB)\n• VIP 2: 20,000 MMK (40 GB)\n• VIP 3: 25,000 MMK (40 GB)\n• VIP 4: 30,000 MMK (120 GB)\n\n⏰ Shop is currently closed.\n\n✨ ATH DIGITAL HUB"
        },
        "payment": {
            "open": "💳 **2 Payment Methods**\n\n📸 **Method 1 - Screenshot**\n1. Transfer to accounts below\n2. Take screenshot\n3. Upload screenshot when placing order\n\n✏️ **Method 2 - Text (if no screenshot)**\n1. Sender name\n2. Last 5 digits of transaction number\n3. Phone number to receive data\n\n🏦 **Accounts:**\n• KBZ Pay: 09789999368 (AUNG THU HTWE)\n• WavePay: 09789999368 (AUNG THU HTWE)\n• AYA Pay: 09789999368 (AUNG THU HTWE)\n\n✨ ATH DIGITAL HUB",
            "closed": "💳 Payment: KBZ Pay / WavePay / AYA Pay\n📞 09789999368 (AUNG THU HTWE)\n\n⏰ Shop is currently closed.\n\n✨ ATH DIGITAL HUB"
        },
        "help": {
            "open": "🆘 **ATH DIGITAL HUB Help Menu**\n\n📌 **VIP Plans** → \"What plans are available?\"\n📌 **Payment** → \"How to pay?\"\n📌 **Order Status** → \"Is my order ready?\"\n📌 **How to Buy** → \"How to purchase?\"\n📌 **Opening Hours** → \"When is the shop open?\"\n\n📞 **Contact:** 09789999368 | t.me/ATHsupport\n\n✨ ATH DIGITAL HUB",
            "closed": "🆘 **Help Menu**\n\n⏰ Shop is currently closed.\n⏰ Opening hours: 9:00 AM to 7:00 PM\n\n📞 Contact: 09789999368 | t.me/ATHsupport\n\n✨ ATH DIGITAL HUB"
        },
        "orderStatus": {
            "open": "📋 **Order Status**\n\nYou can check your order status in \"My Orders\" Tab.\n\n• ⏳ Pending - Waiting for approval\n• ✅ Approved - Order confirmed\n• ❌ Rejected - Order declined\n\n✨ ATH DIGITAL HUB",
            "closed": "📋 Order status will be checked after 9:00 AM.\n\n✨ ATH DIGITAL HUB"
        },
        "serviceHours": {
            "open": "⏰ **Opening/Closing Hours**\n\n🟢 **Opening Hours:** 9:00 AM\n🔴 **Closing Hours:** 7:00 PM\n\n📌 The shop is currently open.\n\n✨ ATH DIGITAL HUB",
            "closed": "⏰ **Opening/Closing Hours**\n\n🟢 **Opening Hours:** 9:00 AM\n🔴 **Closing Hours:** 7:00 PM\n\n⏰ The shop is currently closed.\n\n✨ ATH DIGITAL HUB"
        },
        "default": {
            "open": "🙏 Thank you for your message.\n\n✅ The shop is currently open.\nOur Admin will respond shortly.\n\nFor faster response, type \"help\".\n\n✨ ATH DIGITAL HUB",
            "closed": "🙏 Thank you for your message.\n\n⏰ The shop is currently closed.\n⏰ Opening hours: 9:00 AM to 7:00 PM\n\nWe will respond after 9:00 AM.\n\n✨ ATH DIGITAL HUB"
        }
    },
    zh: {
        "greeting": {
            "open": "👋 您好！欢迎来到 ATH DIGITAL HUB。\n\n有什么可以帮您的吗？\n\n✨ ATH DIGITAL HUB",
            "closed": "👋 您好！\n\n⏰ 商店目前已关闭。\n⏰ 营业时间: 上午 9:00 至 晚上 7:00\n\n✨ ATH DIGITAL HUB"
        },
        "dataMB": {
            "open": "✅ 是的，您可以。您可以立即购买。\n\n🛒 **购买方式:**\n1. 前往套餐标签页\n2. 选择您想要的套餐\n3. 付款\n4. 用截图或文字确认\n\n✨ ATH DIGITAL HUB",
            "closed": "✅ 是的，您可以。\n\n⏰ 商店目前已关闭。\n⏰ 营业时间: 上午 9:00 至 晚上 7:00\n\n请在营业时间内回来购买。\n\n✨ ATH DIGITAL HUB"
        },
        "vipPlan": {
            "open": "📱 ATH DIGITAL HUB 提供以下 VIP 套餐：\n\n🔥 **VIP LEVEL - 1** - 15,000 MMK\n   • 22 GB\n   • 8000 分钟\n   • 5000 短信\n\n⭐ **VIP LEVEL - 2** - 20,000 MMK\n   • 40 GB\n   • 250 网内分钟\n\n💎 **VIP LEVEL - 3** - 25,000 MMK\n   • 40 GB\n   • 1400 网内分钟\n   • 8000 短信\n\n👑 **VIP LEVEL - 4 (ULTRA)** - 30,000 MMK\n   • 120 GB\n\n✨ ATH DIGITAL HUB",
            "closed": "📱 可用 VIP 套餐：\n\n• VIP 1: 15,000 MMK (22 GB)\n• VIP 2: 20,000 MMK (40 GB)\n• VIP 3: 25,000 MMK (40 GB)\n• VIP 4: 30,000 MMK (120 GB)\n\n⏰ 商店目前已关闭。\n请在营业时间内联系（上午 9:00 - 晚上 7:00）。\n\n✨ ATH DIGITAL HUB"
        },
        "payment": {
            "open": "💳 **2 种付款方式**\n\n📸 **方式 1 - 截图**\n1. 转账到以下账户\n2. 截图\n3. 下单时上传截图\n\n✏️ **方式 2 - 文字（如无截图）**\n1. 汇款人姓名\n2. 交易号码后 5 位\n3. 接收数据的手机号码\n\n🏦 **账户：**\n• KBZ Pay: 09789999368 (AUNG THU HTWE)\n• WavePay: 09789999368 (AUNG THU HTWE)\n• AYA Pay: 09789999368 (AUNG THU HTWE)\n\n✨ ATH DIGITAL HUB",
            "closed": "💳 付款方式：KBZ Pay / WavePay / AYA Pay\n📞 09789999368 (AUNG THU HTWE)\n\n⏰ 商店目前已关闭。\n\n✨ ATH DIGITAL HUB"
        },
        "help": {
            "open": "🆘 **ATH DIGITAL HUB 帮助菜单**\n\n📌 **VIP 套餐** → \"有哪些套餐？\"\n📌 **付款** → \"如何付款？\"\n📌 **订单状态** → \"我的订单到了吗？\"\n📌 **购买方式** → \"如何购买？\"\n📌 **营业时间** → \"商店什么时候营业？\"\n\n📞 **联系方式:** 09789999368 | t.me/ATHsupport\n\n✨ ATH DIGITAL HUB",
            "closed": "🆘 **帮助菜单**\n\n⏰ 商店目前已关闭。\n⏰ 营业时间: 上午 9:00 至 晚上 7:00\n\n📞 联系方式: 09789999368 | t.me/ATHsupport\n\n✨ ATH DIGITAL HUB"
        },
        "orderStatus": {
            "open": "📋 **订单状态**\n\n您可以在\"我的订单\"标签页查看订单状态。\n\n• ⏳ 待处理 - 等待批准\n• ✅ 已批准 - 订单已确认\n• ❌ 已拒绝 - 订单被拒绝\n\n✨ ATH DIGITAL HUB",
            "closed": "📋 订单状态将在上午 9:00 后检查。\n\n✨ ATH DIGITAL HUB"
        },
        "serviceHours": {
            "open": "⏰ **营业/关闭时间**\n\n🟢 **营业时间:** 上午 9:00\n🔴 **关闭时间:** 晚上 7:00\n\n📌 商店目前营业中。\n\n✨ ATH DIGITAL HUB",
            "closed": "⏰ **营业/关闭时间**\n\n🟢 **营业时间:** 上午 9:00\n🔴 **关闭时间:** 晚上 7:00\n\n⏰ 商店目前已关闭。\n\n✨ ATH DIGITAL HUB"
        },
        "default": {
            "open": "🙏 感谢您的留言。\n\n✅ 商店目前营业中。\n我们的管理员会尽快回复您。\n\n如需更快回复，请输入 \"help\"。\n\n✨ ATH DIGITAL HUB",
            "closed": "🙏 感谢您的留言。\n\n⏰ 商店目前已关闭。\n⏰ 营业时间: 上午 9:00 至 晚上 7:00\n\n我们会在上午 9:00 后回复您。\n\n✨ ATH DIGITAL HUB"
        }
    }
};

// ============ LOAD LANGUAGES WITH FALLBACK ============
function getLanguageData(lang) {
    const loaded = loadLanguageFile(lang);
    if (loaded) return loaded;
    // Fallback data
    return FALLBACK_DATA[lang] || FALLBACK_DATA['my'];
}

const languages = {
    my: getLanguageData('my'),
    en: getLanguageData('en'),
    zh: getLanguageData('zh')
};

console.log('✅ Languages loaded with fallback!');

// ============ LANGUAGE DETECTION ============
const userLanguages = new Map();

function detectLanguage(message) {
    const lowerMsg = message.toLowerCase();
    
    // Chinese characters detection (CJK Unified Ideographs)
    const chineseRegex = /[\u4e00-\u9fa5]/;
    if (chineseRegex.test(message)) {
        return 'zh';
    }
    
    // Myanmar detection
    const myanmarRegex = /[\u1000-\u109F]/;
    if (myanmarRegex.test(message)) {
        return 'my';
    }
    
    // English detection (default)
    const englishChars = message.match(/[a-zA-Z]/g) || [];
    const totalChars = message.replace(/\s/g, '').length;
    if (totalChars > 0 && (englishChars.length / totalChars) > 0.5) {
        return 'en';
    }
    
    // Default to Myanmar if uncertain
    return 'my';
}

function getUserLanguage(userId) {
    if (userLanguages.has(userId)) {
        return userLanguages.get(userId);
    }
    // Default to Myanmar
    return 'my';
}

function setUserLanguage(userId, language) {
    if (['my', 'en', 'zh'].includes(language)) {
        userLanguages.set(userId, language);
        console.log(`🌍 Language set for user ${userId}: ${language}`);
        return true;
    }
    return false;
}

// ============ KEYWORDS (34 Categories) ============
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
        'မိဘတွေရှိလား', 'မောင်နှမရှိလား', 'အိမ်ထောင်ရှိလား', 'သားသမီးရှိလား'
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
        'ပြေစာတင်နည်း', 'screenshot ဘယ်လိုတင်ရမလဲ'
    ],
    receiptLastDigits: [
        'ပြေစာကနောက်ဆုံးနံပါတ်က ဘယ်ဟာကိုပြောတာလဲ',
        'နောက်ဆုံးနံပါတ်', 'ပြေစာနောက်ဆုံးဂဏန်း'
    ],
    aboutATH: [
        'အေတီအိတ်ချ်', 'ATH', 'ATH DIGITAL HUB', 'ath',
        'ဘာကိုပြောတာလဲ', 'ဘာအဓိပ္ပါယ်လဲ'
    ],
    howToRenew: [
        'ဘယ်လိုသက်တမ်းတိုးရမလဲ', 'သက်တမ်းတိုးနည်း', 'renew', 'ထပ်ဝယ်ရမလဲ'
    ],
    howManyDays: [
        'ဘယ်နှစ်ရက်သုံးလို့ရလဲ', 'ဘယ်လောက်ကြာကြာခံလဲ',
        'ဘယ်လောက်ကြာမလဲ', 'သက်တမ်းဘယ်လောက်လဲ'
    ],
    whatCanUse: [
        'ဘာတွေသုံးလို့ရလဲ', 'ဘာအတွက်သုံးလို့ရလဲ', 'ဘာတွေပါလဲ'
    ],
    whatTimeToBuy: [
        'ဘယ်ချိန်ဝယ်လို့ရလဲ', 'ဘယ်အချိန်ဝယ်လို့ရလဲ',
        'ဘယ်အချိန်ရောင်းလဲ'
    ],
    whatAvailable: [
        'ဘာတွေရှိလဲ', 'ဘာတွေရောင်းလဲ', 'ဘယ်လိုဝန်ဆောင်မှုတွေရှိလဲ'
    ],
    howToReply: [
        'မင်းဘယ်လိုဖြေမလဲ', 'ဘယ်လိုဖြေမလဲ', 'ဘယ်လိုအလုပ်လုပ်လဲ',
        'how do you reply', 'how it works'
    ]
};

// ============ GET AUTO REPLY ============
function getAutoReply(message, isShopOpen, userId = null) {
    // 1. Detect language from message
    const detectedLang = detectLanguage(message);
    console.log(`🔍 Detected language: ${detectedLang} for message: "${message.substring(0, 30)}..."`);
    
    // 2. If userId is provided, save the detected language
    if (userId) {
        setUserLanguage(userId, detectedLang);
    }
    
    // 3. Get the language data
    let langData = languages[detectedLang];
    
    // 4. If the detected language data is not available, fallback to English or Myanmar
    if (!langData) {
        console.warn(`⚠️ No language data for ${detectedLang}, falling back to English`);
        langData = languages.en || languages.my;
    }
    
    // 5. Find matching keyword category
    const lowerMessage = message.toLowerCase().trim();
    let matchedCategory = null;
    let matchedKeyword = null;
    
    for (const [category, keywordList] of Object.entries(keywords)) {
        for (const keyword of keywordList) {
            if (lowerMessage.includes(keyword.toLowerCase()) || lowerMessage === keyword.toLowerCase()) {
                matchedCategory = category;
                matchedKeyword = keyword;
                break;
            }
        }
        if (matchedCategory) break;
    }
    
    // 6. Get reply based on category
    let reply = null;
    if (matchedCategory && langData[matchedCategory]) {
        reply = isShopOpen ? langData[matchedCategory].open : langData[matchedCategory].closed;
        console.log(`📤 Category matched: ${matchedCategory}`);
    }
    
    // 7. If no category matched, use default
    if (!reply && langData.default) {
        reply = isShopOpen ? langData.default.open : langData.default.closed;
        console.log(`📤 Using default reply for: ${detectedLang}`);
    }
    
    // 8. Ultimate fallback (if everything fails)
    if (!reply) {
        reply = isShopOpen 
            ? "🙏 Thank you for your message. Our Admin will respond shortly. ✨ ATH DIGITAL HUB"
            : "🙏 Thank you for your message. Shop is currently closed. Please come back during opening hours. ✨ ATH DIGITAL HUB";
        console.log(`📤 Using ultimate fallback reply`);
    }
    
    console.log(`📤 Auto reply sent in: ${detectedLang}`);
    return reply;
}

// ============ EXPORT ============
module.exports = { 
    getAutoReply, 
    setUserLanguage, 
    getUserLanguage,
    detectLanguage,
    languages
};

console.log('✅ autoReply.js loaded with language detection and fallback!');
