// ============ CHAT CONFIGURATION ============
const CHAT_API_BASE = window.location.origin;
let currentChatUser = null;
let currentChatUsername = null;
let currentChatUserId = null;
let refreshInterval = null;
let isLoading = false;

// ============ GET USER INFO ============
function getCurrentUserInfo() {
    currentChatUser = localStorage.getItem('userPhone');
    currentChatUsername = localStorage.getItem('userName');
    currentChatUserId = localStorage.getItem('userId');
    
    try {
        if (window.parent && window.parent.getCurrentUserPhone) currentChatUser = window.parent.getCurrentUserPhone();
        if (window.parent && window.parent.getCurrentUsername) currentChatUsername = window.parent.getCurrentUsername();
        if (window.parent && window.parent.getCurrentUserId) currentChatUserId = window.parent.getCurrentUserId();
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

// ============ MYANMAR TIME (Fixed) ============
function getMyanmarTime(timestamp) {
    const date = new Date(timestamp);
    const utcTime = date.getTime();
    const myanmarOffset = 6.5 * 60 * 60 * 1000;
    const myanmarDate = new Date(utcTime + myanmarOffset);
    let hours = myanmarDate.getUTCHours();
    const minutes = myanmarDate.getUTCMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

// ============ SECURE ESCAPE HTML (Fixed) ============
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ============ LOAD MESSAGES (Fixed) ============
async function loadChatMessages() {
    if (isLoading) return;
    isLoading = true;
    
    const container = document.getElementById('chatMessages');
    if (!container) {
        isLoading = false;
        return;
    }
    
    try {
        const response = await fetch(`${CHAT_API_BASE}/api/chat/messages`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.messages) {
            if (data.messages.length > 0) {
                renderChatMessages(data.messages);
            } else {
                container.innerHTML = `<div class="chat-loading"><i class="fas fa-comment-dots"></i><br>No messages yet. Start a conversation!</div>`;
            }
        } else {
            throw new Error(data.error || 'Invalid response');
        }
    } catch (error) {
        console.error('Error loading chat:', error);
        container.innerHTML = `
            <div class="chat-loading" style="color: #f43f5e;">
                <i class="fas fa-plug"></i><br>
                Cannot connect to server
            </div>
        `;
    } finally {
        isLoading = false;
    }
}

// ============ RENDER MESSAGES ============
function renderChatMessages(messages) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    if (!messages || messages.length === 0) {
        container.innerHTML = `<div class="chat-loading"><i class="fas fa-comment-dots"></i><br>Be the first to say hello! 👋</div>`;
        return;
    }
    
    let html = '';
    for (const msg of messages) {
        const time = getMyanmarTime(msg.created_at);
        const isUser = !msg.is_admin && msg.user_id === currentChatUserId;
        const senderName = msg.is_admin ? '👑 Admin' : (msg.username || 'User');
        const senderIcon = msg.is_admin ? '<i class="fas fa-shield-alt"></i>' : '<i class="fas fa-user"></i>';
        
        html += `
            <div class="chat-message ${isUser ? 'user' : 'admin'}">
                <div class="message-sender">
                    ${senderIcon} ${escapeHtml(senderName)}
                </div>
                <div class="message-bubble">${escapeHtml(msg.message)}</div>
                <div class="message-time">🕐 ${escapeHtml(time)}</div>
            </div>
        `;
    }
    container.innerHTML = html;
    
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 100);
}

// ============ SEND MESSAGE (Fixed) ============
async function sendChatMessage() {
    const input = document.getElementById('chatMessageInput');
    const message = input.value.trim();
    const sendBtn = document.getElementById('chatSendBtn');
    
    if (!message) return;
    
    if (currentChatUser === 'guest' || !currentChatUserId) {
        showChatNotification("Please login to send messages", true);
        return;
    }
    
    // Show loading state
    const originalBtnHtml = sendBtn.innerHTML;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i>';
    input.disabled = true;
    sendBtn.disabled = true;
    
    try {
        const response = await fetch(`${CHAT_API_BASE}/api/chat/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentChatUserId,
                username: currentChatUsername || 'User',
                message: message
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            input.value = '';
            input.style.height = 'auto';
            await loadChatMessages();
            showChatNotification('Message sent!');
        } else {
            showChatNotification(data.error || "Failed to send", true);
        }
    } catch (error) {
        console.error('Send error:', error);
        showChatNotification("Connection error. Please try again.", true);
    } finally {
        input.disabled = false;
        sendBtn.disabled = false;
        sendBtn.innerHTML = originalBtnHtml;
        input.focus();
    }
}

// ============ SHOW NOTIFICATION ============
function showChatNotification(message, isError = false) {
    try {
        if (window.parent && window.parent.showToast) {
            window.parent.showToast(message, isError);
        } else {
            const toast = document.createElement('div');
            toast.textContent = message;
            toast.style.cssText = `
                position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
                background: ${isError ? '#f43f5e' : '#10b981'}; color: white;
                padding: 8px 16px; border-radius: 40px; font-size: 0.75rem;
                z-index: 2000; white-space: nowrap;
                animation: fadeIn 0.3s ease;
            `;
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 300);
            }, 2500);
        }
    } catch(e) {
        console.log('Toast error:', e);
    }
}

// ============ AUTO RESIZE TEXTAREA ============
function autoResizeTextarea() {
    const textarea = document.getElementById('chatMessageInput');
    if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 80) + 'px';
    }
}

// ============ TOGGLE CHAT ============
function toggleChat() {
    const container = document.querySelector('.chat-widget-container');
    if (container) {
        container.classList.toggle('minimized');
        if (!container.classList.contains('minimized')) {
            loadChatMessages();
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
    await loadChatMessages();
    setupKeyboardShortcuts();
    
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
        const container = document.querySelector('.chat-widget-container');
        if (container && !container.classList.contains('minimized')) {
            loadChatMessages();
        }
    }, 5000);
    
    console.log('Chat initialized successfully');
}

// ============ CLEANUP (Fixed) ============
function cleanupChat() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
    console.log('Chat cleaned up');
}

// ============ START ============
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChat);
} else {
    initChat();
}
window.addEventListener('beforeunload', cleanupChat);

// ============ EXPOSE GLOBAL FUNCTIONS ============
window.sendChatMessage = sendChatMessage;
window.toggleChat = toggleChat;
window.loadChatMessages = loadChatMessages;
window.closeChatWidget = closeChatWidget;
window.chatEscapeHtml = escapeHtml;
