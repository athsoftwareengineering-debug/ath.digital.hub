// ============ CHAT CONFIGURATION ============
const CHAT_API_BASE = window.location.origin;
let currentChatUser = null;
let currentChatUsername = null;
let currentChatUserId = null;
let refreshInterval = null;
let currentMode = 'global';

// ============ GET USER INFO ============
function getCurrentUserInfo() {
    currentChatUser = localStorage.getItem('userPhone');
    currentChatUsername = localStorage.getItem('userName');
    currentChatUserId = localStorage.getItem('userId');
    
    try {
        if (window.parent && window.parent.getCurrentUserPhone) {
            currentChatUser = window.parent.getCurrentUserPhone();
        }
        if (window.parent && window.parent.getCurrentUsername) {
            currentChatUsername = window.parent.getCurrentUsername();
        }
        if (window.parent && window.parent.getCurrentUserId) {
            currentChatUserId = window.parent.getCurrentUserId();
        }
    } catch(e) {
        console.log('Cannot access parent window');
    }
    
    if (!currentChatUser) {
        currentChatUser = 'guest';
        currentChatUsername = 'Guest User';
        currentChatUserId = 'guest_' + Date.now();
    }
    
    console.log('Chat User:', currentChatUser, 'User ID:', currentChatUserId);
}

// ============ ADD MODE TABS ============
function addModeTabs() {
    const chatBody = document.querySelector('.chat-body');
    if (!chatBody) return;
    
    // Remove existing tabs if any
    const existingTabs = document.querySelector('.user-chat-tabs');
    if (existingTabs) existingTabs.remove();
    
    const tabsDiv = document.createElement('div');
    tabsDiv.className = 'user-chat-tabs';
    tabsDiv.style.cssText = `
        display: flex;
        gap: 10px;
        padding: 10px 12px;
        background: rgba(0,0,0,0.3);
        border-bottom: 1px solid rgba(0,212,255,0.1);
    `;
    
    tabsDiv.innerHTML = `
        <button id="userGlobalTab" style="
            flex: 1;
            padding: 8px 12px;
            border: none;
            font-size: 0.75rem;
            font-weight: 600;
            cursor: pointer;
            border-radius: 40px;
            background: linear-gradient(135deg, #00d4ff, #0891b2);
            color: white;
        ">
            🌍 လူတိုင်းမြင်ရ
        </button>
        <button id="userPrivateTab" style="
            flex: 1;
            padding: 8px 12px;
            border: none;
            font-size: 0.75rem;
            font-weight: 600;
            cursor: pointer;
            border-radius: 40px;
            background: rgba(255,255,255,0.08);
            color: #94a3b8;
        ">
            🔒 Admin သို့ သီးသန့်
        </button>
    `;
    
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
        chatBody.insertBefore(tabsDiv, messagesContainer);
    }
    
    // Global Chat Tab
    document.getElementById('userGlobalTab').onclick = () => {
        currentMode = 'global';
        document.getElementById('userGlobalTab').style.background = 'linear-gradient(135deg, #00d4ff, #0891b2)';
        document.getElementById('userGlobalTab').style.color = 'white';
        document.getElementById('userPrivateTab').style.background = 'rgba(255,255,255,0.08)';
        document.getElementById('userPrivateTab').style.color = '#94a3b8';
        const note = document.querySelector('.chat-note');
        if (note) note.innerHTML = '🌍 လူတိုင်းမြင်ရသော Chat - အားလုံးမြင်နိုင်ပါသည်';
        loadChatMessages();
    };
    
    // Private Chat Tab
    document.getElementById('userPrivateTab').onclick = () => {
        currentMode = 'private';
        document.getElementById('userPrivateTab').style.background = 'linear-gradient(135deg, #f43f5e, #e11d48)';
        document.getElementById('userPrivateTab').style.color = 'white';
        document.getElementById('userGlobalTab').style.background = 'rgba(255,255,255,0.08)';
        document.getElementById('userGlobalTab').style.color = '#94a3b8';
        const note = document.querySelector('.chat-note');
        if (note) note.innerHTML = '🔒 Admin သို့ သီးသန့် - Admin မှသာ ဖတ်နိုင်ပါသည်';
        loadPrivateMessagesForUser();
    };
}

// ============ LOAD GLOBAL MESSAGES ============
async function loadChatMessages() {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    try {
        const response = await fetch(`${CHAT_API_BASE}/api/chat/messages`);
        const data = await response.json();
        
        if (data.success && data.messages && data.messages.length > 0) {
            renderGlobalMessages(data.messages);
        } else {
            container.innerHTML = '<div class="chat-loading">💬 မက်ဆေ့ခ်ျများ မရှိသေးပါ။ ပထမဆုံး စတင်လိုက်ပါ!</div>';
        }
    } catch (error) {
        console.error('Error loading global messages:', error);
        container.innerHTML = '<div class="chat-loading" style="color:#f43f5e;">⚠️ ဆာဗာသို့ ချိတ်ဆက်၍မရပါ</div>';
    }
}

function renderGlobalMessages(messages) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    let html = '';
    let lastDate = null;
    
    for (const msg of messages) {
        const msgDate = new Date(msg.created_at).toLocaleDateString();
        const time = new Date(msg.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
        const isUser = !msg.is_admin && msg.user_id === currentChatUserId;
        const senderName = msg.is_admin ? '👑 Admin' : (msg.username || 'User');
        
        if (lastDate !== msgDate) {
            html += `<div style="text-align:center; margin:10px 0;"><span style="background:rgba(0,212,255,0.1); padding:4px 12px; border-radius:40px; font-size:0.6rem;">📅 ${msgDate}</span></div>`;
            lastDate = msgDate;
        }
        
        html += `
            <div class="chat-message ${isUser ? 'user' : 'admin'}">
                <div class="message-sender">${senderName}</div>
                <div class="message-bubble">${escapeHtml(msg.message)}</div>
                <div class="message-time">${time}</div>
            </div>
        `;
    }
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

// ============ LOAD PRIVATE MESSAGES ============
async function loadPrivateMessagesForUser() {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    if (!currentChatUserId || currentChatUserId === 'guest') {
        container.innerHTML = '<div class="chat-loading">🔒 ကျေးဇူးပြု၍ အကောင့်ဝင်ပါ။</div>';
        return;
    }
    
    try {
        const response = await fetch(`${CHAT_API_BASE}/api/chat/private/${currentChatUserId}?currentUserId=${currentChatUserId}`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        console.log('Private messages:', data);
        
        if (data.success && data.messages && data.messages.length > 0) {
            renderPrivateMessages(data.messages);
        } else {
            container.innerHTML = `
                <div class="chat-loading">
                    🔒 Admin သို့ စာပို့ရန် အောက်ပါအကွက်တွင် ရေးပါ။<br>
                    Admin မှ ပြန်လည်ဖြေကြားပါမည်။
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading private messages:', error);
        container.innerHTML = '<div class="chat-loading" style="color:#f43f5e;">⚠️ ကိုယ်ပိုင်မက်ဆေ့ခ်ျများ ရယူ၍မရပါ</div>';
    }
}

function renderPrivateMessages(messages) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    let html = `<div style="background:rgba(244,63,94,0.1); padding:10px; border-radius:12px; margin-bottom:12px; text-align:center; font-size:0.7rem;">
        🔒 <strong>Admin နှင့် သီးသန့်စကားပြောခန်း</strong><br>
        သင့်စာများကို Admin မှသာလျှင် ဖတ်ရှုနိုင်ပါသည်။
    </div>`;
    
    let lastDate = null;
    
    for (const msg of messages) {
        const msgDate = new Date(msg.created_at).toLocaleDateString();
        const time = new Date(msg.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
        const isUser = msg.sender_id === currentChatUserId;
        const senderName = isUser ? 'ကျွန်ုပ်' : '👑 Admin';
        
        if (lastDate !== msgDate) {
            html += `<div style="text-align:center; margin:10px 0;"><span style="background:rgba(244,63,94,0.1); padding:4px 12px; border-radius:40px; font-size:0.6rem;">📅 ${msgDate}</span></div>`;
            lastDate = msgDate;
        }
        
        html += `
            <div class="chat-message ${isUser ? 'user' : 'admin'}">
                <div class="message-sender">${senderName}</div>
                <div class="message-bubble">${escapeHtml(msg.message)}</div>
                <div class="message-time">${time}</div>
            </div>
        `;
    }
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

// ============ SEND MESSAGE ============
async function sendChatMessage() {
    const input = document.getElementById('chatMessageInput');
    const message = input.value.trim();
    const sendBtn = document.querySelector('.chat-send-btn');
    
    if (!message) {
        showChatNotification("စာတစ်ခုခု ရေးပါ။", true);
        return;
    }
    
    if (currentChatUser === 'guest' || !currentChatUserId) {
        showChatNotification("ကျေးဇူးပြု၍ အကောင့်ဝင်ပါ။", true);
        return;
    }
    
    input.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    
    try {
        let result;
        
        if (currentMode === 'private') {
            const response = await fetch(`${CHAT_API_BASE}/api/chat/private/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    sender_id: currentChatUserId,
                    receiver_id: 'admin',
                    sender_name: currentChatUsername || 'User',
                    receiver_name: 'Admin',
                    message: message
                })
            });
            result = await response.json();
            
            if (result.success) {
                input.value = '';
                showChatNotification("✅ Admin သို့ သီးသန့်ပို့ပြီးပါပြီ။");
                await loadPrivateMessagesForUser();
            } else {
                showChatNotification(result.error || "ပို့လို့မရပါ", true);
            }
        } else {
            const response = await fetch(`${CHAT_API_BASE}/api/chat/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentChatUserId,
                    username: currentChatUsername || 'User',
                    message: message
                })
            });
            result = await response.json();
            
            if (result.success) {
                input.value = '';
                showChatNotification("✅ လူတိုင်းမြင်ရသော chat တွင် ပို့ပြီးပါပြီ။");
                await loadChatMessages();
            } else {
                showChatNotification(result.error || "ပို့လို့မရပါ", true);
            }
        }
    } catch (error) {
        console.error('Send error:', error);
        showChatNotification("ဆာဗာသို့ ချိတ်ဆက်၍မရပါ။", true);
    } finally {
        input.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
        input.focus();
    }
}

// ============ UTILITIES ============
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function showChatNotification(message, isError = false) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: ${isError ? '#f43f5e' : '#10b981'};
        color: white;
        padding: 8px 16px;
        border-radius: 40px;
        font-size: 0.7rem;
        z-index: 2000;
        white-space: nowrap;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}

function autoResizeTextarea() {
    const textarea = document.getElementById('chatMessageInput');
    if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 80) + 'px';
    }
}

function setupKeyboardShortcuts() {
    const input = document.getElementById('chatMessageInput');
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });
        input.addEventListener('input', autoResizeTextarea);
    }
}

function toggleChat() {
    const container = document.querySelector('.chat-widget-container');
    if (container) container.classList.toggle('minimized');
}

function closeChatWidget() {
    if (window.parent && window.parent.closeChatWidget) {
        window.parent.closeChatWidget();
    }
}

// ============ INITIALIZE ============
async function initChat() {
    console.log('Initializing chat...');
    getCurrentUserInfo();
    addModeTabs();
    setupKeyboardShortcuts();
    
    await loadChatMessages();
    
    refreshInterval = setInterval(() => {
        const container = document.querySelector('.chat-widget-container');
        if (container && !container.classList.contains('minimized')) {
            if (currentMode === 'global') {
                loadChatMessages();
            } else {
                loadPrivateMessagesForUser();
            }
        }
    }, 15000);
}

function cleanupChat() {
    if (refreshInterval) clearInterval(refreshInterval);
}

document.addEventListener('DOMContentLoaded', initChat);
window.addEventListener('beforeunload', cleanupChat);

window.sendChatMessage = sendChatMessage;
window.toggleChat = toggleChat;
window.closeChatWidget = closeChatWidget;
