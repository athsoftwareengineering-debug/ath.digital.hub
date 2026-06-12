// ad-widget.js - ATH Digital Hub Ad Widget
(function() {
    const ADS_API = '/api/ads';
    let activeAds = [];
    let settings = null;
    let currentAd = null;
    let cycleInterval = null;
    let adContainer = null;
    
    async function fetchAds() {
        try {
            const res = await fetch(ADS_API);
            const data = await res.json();
            if (data.success) {
                const today = new Date().toISOString().slice(0,10);
                activeAds = (data.ads || []).filter(ad => 
                    ad.active === true && 
                    (!ad.expiry_date || ad.expiry_date >= today)
                );
            }
        } catch(e) { console.error('Ads fetch error:', e); }
    }
    
    async function fetchSettings() {
        try {
            const res = await fetch('/api/ad-settings');
            const data = await res.json();
            if (data.success) settings = data.settings;
        } catch(e) { console.error('Settings fetch error:', e); }
    }
    
    function getActiveAds() {
        const today = new Date().toISOString().slice(0,10);
        return activeAds.filter(ad => ad.active && (!ad.expiry_date || ad.expiry_date >= today));
    }
    
    function weightedRandomSelect() {
        const ads = getActiveAds();
        if (!ads.length) return null;
        let totalWeight = ads.reduce((sum, ad) => sum + (ad.display_weight || 1), 0);
        let random = Math.random() * totalWeight;
        let accum = 0;
        for (let ad of ads) {
            accum += (ad.display_weight || 1);
            if (random <= accum) return ad;
        }
        return ads[0];
    }
    
    function roundRobinSelect() {
        const ads = getActiveAds();
        if (!ads.length) return null;
        let lastIdx = parseInt(localStorage.getItem('ath_ad_index') || '0');
        let nextIdx = (lastIdx + 1) % ads.length;
        localStorage.setItem('ath_ad_index', nextIdx);
        return ads[nextIdx];
    }
    
    function selectAd() {
        const ads = getActiveAds();
        if (!ads.length) return null;
        if (!settings) return ads[0];
        if (settings.rotation_mode === 'weighted') return weightedRandomSelect();
        if (settings.rotation_mode === 'roundrobin') return roundRobinSelect();
        return ads[Math.floor(Math.random() * ads.length)];
    }
    
    function isUserLoggedIn() {
        if (window.currentUser) return true;
        if (localStorage.getItem('userPhone')) return true;
        return false;
    }
    
    function createAdContainer() {
        adContainer = document.getElementById('adContainer');
        if (!adContainer) {
            adContainer = document.createElement('div');
            adContainer.id = 'adContainer';
            adContainer.style.margin = '16px 0';
            const homeTab = document.getElementById('homeTab');
            const banner = document.getElementById('salesStatusBanner');
            if (homeTab && banner) {
                banner.after(adContainer);
            }
        }
        return adContainer;
    }
    
    function renderAd(ad) {
        const container = createAdContainer();
        if (!container || !ad) return;
        
        container.innerHTML = `
            <div style="background:linear-gradient(135deg,#0f0c29,#302b63); border-radius:24px; padding:16px; margin:8px 0; box-shadow:0 15px 35px rgba(0,0,0,0.3); border:1px solid rgba(0,212,255,0.2);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <span style="background:rgba(255,215,0,0.2); color:#FFD700; padding:4px 12px; border-radius:60px; font-size:11px; font-weight:bold;">📢 SPONSORED</span>
                    ${settings?.show_navigation ? `<button id="nextAdBtn" style="background:rgba(255,255,255,0.1); border:none; color:white; padding:4px 12px; border-radius:40px; cursor:pointer; font-size:12px;">➡ နောက်တစ်ခု</button>` : ''}
                </div>
                <a href="${ad.destination_url}" target="_blank" id="adLink" style="display:block; text-align:center;">
                    <img src="${ad.image_url}" alt="${ad.alt_text || ad.name}" style="max-width:100%; border-radius:16px; max-height:120px; object-fit:contain;">
                    ${ad.alt_text ? `<p style="color:#ccc; margin-top:10px; font-size:13px;">✨ ${ad.alt_text}</p>` : ''}
                </a>
                <div style="text-align:center; margin-top:12px;">
                    <button id="closeAdBtn" style="background:rgba(220,60,60,0.3); border:none; color:#ff9e9e; padding:5px 16px; border-radius:40px; cursor:pointer; font-size:12px;">✖ ပိတ်မည်</button>
                </div>
            </div>
        `;
        
        document.getElementById('nextAdBtn')?.addEventListener('click', () => refreshAd());
        document.getElementById('closeAdBtn')?.addEventListener('click', () => {
            container.style.display = 'none';
            localStorage.setItem('ath_ad_closed', 'true');
            if (cycleInterval) clearInterval(cycleInterval);
        });
        
        document.getElementById('adLink')?.addEventListener('click', async () => {
            await fetch(`/api/ads/${ad.id}/click`, { method: 'POST' });
        });
        
        fetch(`/api/ads/${ad.id}/view`, { method: 'POST' }).catch(e=>console.log);
    }
    
    async function refreshAd() {
        await fetchAds();
        const ad = selectAd();
        if (ad) renderAd(ad);
        if (settings?.auto_cycle_seconds >= 5) startAutoCycle();
    }
    
    function startAutoCycle() {
        if (cycleInterval) clearInterval(cycleInterval);
        if (settings?.auto_cycle_seconds >= 5) {
            cycleInterval = setInterval(() => {
                if (adContainer && adContainer.style.display !== 'none') {
                    refreshAd();
                }
            }, settings.auto_cycle_seconds * 1000);
        }
    }
    
    async function init() {
        if (localStorage.getItem('ath_ad_closed') === 'true') return;
        if (!isUserLoggedIn()) return;
        
        await fetchSettings();
        await fetchAds();
        const ad = selectAd();
        if (ad) {
            renderAd(ad);
            if (settings?.auto_cycle_seconds >= 5) startAutoCycle();
        }
    }
    
    function watchForLogin() {
        let wasLoggedIn = isUserLoggedIn();
        setInterval(() => {
            const nowLoggedIn = isUserLoggedIn();
            if (nowLoggedIn && !wasLoggedIn && localStorage.getItem('ath_ad_closed') !== 'true') {
                init();
            }
            wasLoggedIn = nowLoggedIn;
        }, 3000);
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { init(); watchForLogin(); });
    } else {
        init();
        watchForLogin();
    }
})();
