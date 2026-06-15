// ============ CHAT CONFIGURATION ============
const CHAT_API_BASE = window.location.origin;
let currentChatUser = null;
let currentChatUsername = null;
let currentChatUserId = null;
let refreshInterval = null;
let currentMode = 'global'; // 'global' or 'private'

// ============ GET USER INFO ============
function getCurrentUserInfo() {
    // Try to get from localStorage
    currentChatUser = localStorage.getItem('userPhone');
    currentChatUsername = localStorage.getItem('userName');
    currentChatUserId = localStorage.getItem('userId');
    
    // Try to get from parent window (index.html)
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
    
    // Demo mode fallback (for testing)
    if (!currentChatUser) {
        currentChatUser = 'guest';
        currentChatUsername = 'Guest User';
        currentChatUserId = 'guest_' + Date.now();
    }
    
    console.log('Chat User:', currentChatUser, 'User ID:', currentChatUserId);
}

// ============ MODE TOGGLE UI ============
function addModeToggle() {
    const inputContainer = document.querySelector('.chat-input-container');
    if (!inputContainer) return;
    
    // Check if toggle already exists
    if (document.querySelector('.chat-mode-toggle')) return;
    
    const modeToggle = document.createElement('div');
    modeToggle.className = 'chat-mode-toggle';
    modeToggle.style.cssText = `
        display: flex;
        gap: 8px;
        margin-bottom: 10px;
        justify-content: center;
    `;
    
    modeToggle.innerHTML = `
        <button id="modeGlobalBtn" class="mode-btn active" style="
            background: ${currentMode === 'global' ? 'linear-gradient(135deg, #00d4ff, #0891b2)' : 'rgba(255,255,255,0.1)'};
            border: none;
            padding: 5px 12px;
            border-radius: 40px;
            color: white;
            font-size: 0.65rem;
            cursor: pointer;
            transition: all 0.2s;
        ">
            <i class="fas fa-globe"></i> လူတိုင်းမြင်ရ
        </button>
        <button id="modePrivateBtn" class="mode-btn" style="
            background: ${currentMode === 'private' ? 'linear-gradient(135deg, #f43f5e, #e11d48)' : 'rgba(255,255,255,0.1)'};
            border: none;
            padding: 5px 12px;
            border-radius: 40px;
            color: white;
            font-size: 0.65rem;
            cursor: pointer;
            transition: all 0.2s;
        ">
            <i class="fas fa-lock"></i> Admin သို့ သီးသန့်
        </button>
    `;
    
    inputContainer.insertBefore(modeToggle, inputContainer.firstChild);
    
    document.getElementById('modeGlobalBtn')?.addEventListener('click', () => {
        currentMode = 'global';
        document.getElementById('modeGlobalBtn').style.background = 'linear-gradient(135deg, #00d4ff, #0891b2)';
        document.getElementById('modePrivateBtn').style.background = 'rgba(255,255,255,0.1)';
        document.querySelector('.chat-note').innerHTML = '<i class="fas fa-globe"></i> လူတိုင်းမြင်ရသော Chat - အားလုံးမြင်နိုင်ပါသည်';
        loadChatMessages();
    });
    
    document.getElementById('modePrivateBtn')?.addEventListener('click', () => {
        currentMode = 'private';
        document.getElementById('modePrivateBtn').style.background = 'linear-gradient(135deg, #f43f5e, #e11d48)';
        document.getElementById('modeGlobalBtn').style.background = 'rgba(255,255,255,0.1)';
        document.querySelector('.chat-note').innerHTML = '<i class="fas fa-lock"></i> Admin သို့ သီးသန့် - Admin မှသာ ဖတ်နိုင်ပါသည်';
        loadPrivateMessagesForUser();
    });
}

// ============ LOAD GLOBAL MESSAGES ============
async function loadChatMessages() {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    try {
        const response = await fetch(`${CHAT_API_BASE}/api/chat/messages`);
        const data = await response.json();
        
        if (data.success && data.messages && data.messages.length > 0) {
            renderChatMessages(data.messages);
        } else {
            container.innerHTML = `
                <div class="chat-loading">
                    <i class="fas fa-comment-dots"></i><br>
                    မက်ဆေ့ခ်ျများ မရှိသေးပါ။ ပထမဆုံး စတင်လိုက်ပါ! 👋
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading chat:', error);
        container.innerHTML = `
            <div class="chat-loading" style="color: #f43f5e;">
                <i class="fas fa-plug"></i><br>
                ဆာဗာသို့ ချိတ်ဆက်၍မရပါ
            </div>
        `;
    }
}

// ============ RENDER GLOBAL MESSAGES ============
function renderChatMessages(messages) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    if (!messages || messages.length === 0) {
        container.innerHTML = `
            <div class="chat-loading">
                <i class="fas fa-comment-dots"></i><br>
                ပထမဆုံး မင်္ဂလာပါလို့ နှုတ်ဆက်လိုက်ပါ! 👋
            </div>
        `;
        return;
    }
    
    let html = '';
    let lastDate = null;
    
    for (const msg of messages) {
        const msgDate = new Date(msg.created_at).toLocaleDateString();
        const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isUser = !msg.is_admin && msg.user_id === currentChatUserId;
        const senderName = msg.is_admin ? '👑 Admin' : (msg.username || 'User');
        const senderIcon = msg.is_admin ? '<i class="fas fa-shield-alt"></i>' : '<i class="fas fa-user"></i>';
        
        if (lastDate !== msgDate) {
            html += `<div style="text-align:center; margin:8px 0;"><span style="background:rgba(0,212,255,0.1); padding:2px 10px; border-radius:40px; font-size:0.55rem; color:#64748b;">📅 ${msgDate}</span></div>`;
            lastDate = msgDate;
        }
        
        html += `
            <div class="chat-message ${isUser ? 'user' : 'admin'}">
                <div class="message-sender">
                    ${senderIcon} ${escapeHtml(senderName)}
                </div>
                <div class="message-bubble">${escapeHtml(msg.message)}</div>
                <div class="message-time">🕐 ${time}</div>
            </div>
        `;
    }
    container.innerHTML = html;
    
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 100);
}

// ============ LOAD PRIVATE MESSAGES (User Side) ============
async function loadPrivateMessagesForUser() {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    if (!currentChatUserId || currentChatUserId === 'guest') {
        container.innerHTML = `
            <div class="chat-loading">
                <i class="fas fa-lock"></i><br>
                ကျေးဇူးပြု၍ အကောင့်ဝင်ပါ။
            </div>
        `;
        return;
    }
    
    try {
        const response = await fetch(`${CHAT_API_BASE}/api/chat/private/${currentChatUserId}?currentUserId=${currentChatUserId}`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (data.success && data.messages && data.messages.length > 0) {
            renderPrivateMessagesForUser(data.messages);
        } else {
            container.innerHTML = `
                <div class="chat-loading">
                    <i class="fas fa-lock"></i><br>
                    Admin သို့ စာပို့ရန် အောက်ပါအကွက်တွင် ရေးပါ။<br>
                    Admin မှ ပြန်လည်ဖြေကြားပါမည်။
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading private messages:', error);
        container.innerHTML = `
            <div class="chat-loading" style="color: #f43f5e;">
                <i class="fas fa-plug"></i><br>
                ကိုယ်ပိုင် မက်ဆေ့ခ်ျများ ရယူ၍မရပါ
            </div>
        `;
    }
}

// ============ RENDER PRIVATE MESSAGES (User Side) ============
function renderPrivateMessagesForUser(messages) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    let html = `<div style="background:rgba(0,212,255,0.1); padding:8px; border-radius:12px; margin-bottom:12px; text-align:center; font-size:11px;">
        🔒 <strong>Admin နှင့် သီးသန့်စကားပြောခန်း</strong><br>
        သင့်စာများကို Admin မှသာလျှင် ဖတ်ရှုနိုင်ပါသည်။
    </div>`;
    
    let lastDate = null;
    
    for (const msg of messages) {
        const msgDate = new Date(msg.created_at).toLocaleDateString();
        const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isUser = msg.sender_id === currentChatUserId;
        const senderName = isUser ? 'ကျွန်ုပ်' : '👑 Admin';
        
        if (lastDate !== msgDate) {
            html += `<div style="text-align:center; margin:8px 0;"><span style="background:rgba(0,212,255,0.1); padding:2px 10px; border-radius:40px; font-size:0.55rem; color:#64748b;">📅 ${msgDate}</span></div>`;
            lastDate = msgDate;
        }
        
        html += `
            <div class="chat-message ${isUser ? 'user' : 'admin'}">
                <div class="message-sender">
                    ${isUser ? '<i class="fas fa-user"></i>' : '<i class="fas fa-shield-alt"></i>'} ${escapeHtml(senderName)}
                </div>
                <div class="message-bubble">${escapeHtml(msg.message)}</div>
                <div class="message-time">🕐 ${time}</div>
            </div>
        `;
    }
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

// ============ SEND MESSAGE (ပြင်ဆင်ပြီး) ============
async function sendChatMessage() {
    const input = document.getElementById('chatMessageInput');
    const message = input.value.trim();
    const sendBtn = document.querySelector('.chat-send-btn');
    
    if (!message) return;
    
    if (currentChatUser === 'guest' || !currentChatUserId) {
        showChatNotification("ကျေးဇူးပြု၍ အကောင့်ဝင်ရန် လိုအပ်ပါသည်။", true);
        return;
    }
    
    input.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    
    try {
        let response;
        let result;
        
        if (currentMode === 'private') {
            // Private message to Admin
            response = await fetch(`${CHAT_API_BASE}/api/chat/private/send`, {
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
                input.style.height = 'auto';
                await loadPrivateMessagesForUser();
                showChatNotification("✅ Admin သို့ သီးသန့်ပို့ပြီးပါပြီ။ ပြန်လည်ဖြေကြားပါမည်။");
            } else {
                showChatNotification(result.error || "Failed to send", true);
            }
        } else {
            // Global message (everyone can see)
            response = await fetch(`${CHAT_API_BASE}/api/chat/send`, {
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
                input.style.height = 'auto';
                await loadChatMessages();
                showChatNotification("✅ လူတိုင်းမြင်ရသော chat တွင် ပို့ပြီးပါပြီ။");
            } else {
                showChatNotification(result.error || "Failed to send", true);
            }
        }
    } catch (error) {
        console.error('Send error:', error);
        showChatNotification("Connection error. Please try again.", true);
    } finally {
        input.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
        input.focus();
    }
}

// ============ SHOW NOTIFICATION (Toast) ============
function showChatNotification(message, isError = false) {
    try {
        if (window.parent && window.parent.showToast) {
            window.parent.showToast(message, isError);
        } else {
            const toast = document.createElement('div');
            toast.textContent = message;
            toast.style.cssText = `
                position: fixed;
                bottom: 100px;
                left: 50%;
                transform: translateX(-50%);
                background: ${isError ? '#f43f5e' : '#10b981'};
                color: white;
                padding: 8px 16px;
                border-radius: 40px;
                font-size: 0.75rem;
                z-index: 2000;
                white-space: nowrap;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            `;
            document.body.appendChild(toast);
            setTimeout(() => {
                if (toast && toast.remove) toast.remove();
            }, 2500);
        }
    } catch(e) {
        console.log('Toast error:', e);
        alert(message);
    }
}

// ============ ESCAPE HTML (XSS Protection) ============
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ============ AUTO RESIZE TEXTAREA ============
function autoResizeTextarea() {
    const textarea = document.getElementById('chatMessageInput');
    if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 80) + 'px';
    }
}

// ============ TOGGLE CHAT MINIMIZE ============
function toggleChat() {
    const container = document.querySelector('.chat-widget-container');
    if (container) {
        container.classList.toggle('minimized');
        if (!container.classList.contains('minimized')) {
            if (currentMode === 'global') {
                loadChatMessages();
            } else {
                loadPrivateMessagesForUser();
            }
        }
    }
}

// ============ CLOSE CHAT WIDGET ============
function closeChatWidget() {
    const container = document.querySelector('.chat-widget-container');
    if (container && window.parent && window.parent.closeChatWidget) {
        window.parent.closeChatWidget();
    } else if (container) {
        container.style.display = 'none';
    }
}

// ============ KEYBOARD SHORTCUTS ============
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

// ============ INITIALIZE CHAT ============
async function initChat() {
    console.log('Initializing chat...');
    getCurrentUserInfo();
    addModeToggle();
    setupKeyboardShortcuts();
    
    // Load initial messages based on mode
    if (currentMode === 'global') {
        await loadChatMessages();
    } else {
        await loadPrivateMessagesForUser();
    }
    
    // Refresh messages every 5 seconds (polling)
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
        const container = document.querySelector('.chat-widget-container');
        if (container && !container.classList.contains('minimized')) {
            if (currentMode === 'global') {
                loadChatMessages();
            } else {
                loadPrivateMessagesForUser();
            }
        }
    }, 5000);
    
    console.log('Chat initialized successfully');
}

// ============ CLEANUP ============
function cleanupChat() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
    console.log('Chat cleaned up');
}

// ============ START ============
document.addEventListener('DOMContentLoaded', initChat);
window.addEventListener('beforeunload', cleanupChat);

// ============ EXPOSE GLOBAL FUNCTIONS ============
window.sendChatMessage = sendChatMessage;
window.toggleChat = toggleChat;
window.loadChatMessages = loadChatMessages;
window.closeChatWidget = closeChatWidget;
window.chatEscapeHtml = escapeHtml;
