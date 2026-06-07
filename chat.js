// ============ CHAT CONFIGURATION ============
const CHAT_API_BASE = window.location.origin;
let currentChatUser = null;
let currentChatUsername = null;
let currentChatUserId = null;
let chatSubscription = null;

// Supabase configuration
const SUPABASE_URL = 'https://your-project.supabase.co';  // ← Replace with your URL
const SUPABASE_ANON_KEY = 'your-anon-key';  // ← Replace with your key

// Initialize Supabase client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============ GET USER INFO ============
function getCurrentUserInfo() {
    // Try to get from localStorage
    currentChatUser = localStorage.getItem('userPhone');
    currentChatUsername = localStorage.getItem('userName');
    currentChatUserId = localStorage.getItem('userId');
    
    // Try to get from parent window
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
    
    // Demo mode fallback
    if (!currentChatUser) {
        currentChatUser = 'guest';
        currentChatUsername = 'Guest User';
        currentChatUserId = 'guest_' + Date.now();
    }
}

// ============ LOAD MESSAGES ============
async function loadChatMessages() {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    try {
        const response = await fetch(`${CHAT_API_BASE}/api/chat/messages`);
        const data = await response.json();
        
        if (data.success && data.messages) {
            renderChatMessages(data.messages);
        } else {
            container.innerHTML = `
                <div class="chat-loading">
                    <i class="fas fa-comment-dots"></i><br>
                    No messages yet. Start a conversation!
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading chat:', error);
        container.innerHTML = `
            <div class="chat-loading" style="color: #f43f5e;">
                <i class="fas fa-plug"></i><br>
                Cannot connect to server
            </div>
        `;
    }
}

// ============ RENDER MESSAGES ============
function renderChatMessages(messages) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    if (!messages || messages.length === 0) {
        container.innerHTML = `
            <div class="chat-loading">
                <i class="fas fa-comment-dots"></i><br>
                Be the first to say hello! 👋
            </div>
        `;
        return;
    }
    
    let html = '';
    for (const msg of messages) {
        const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isUser = !msg.is_admin && msg.user_id === currentChatUserId;
        const senderName = msg.is_admin ? '👑 Admin' : (msg.username || 'User');
        const senderIcon = msg.is_admin ? '<i class="fas fa-shield-alt"></i>' : '<i class="fas fa-user"></i>';
        
        html += `
            <div class="chat-message ${isUser ? 'user' : 'admin'}">
                <div class="message-sender">
                    ${senderIcon} ${escapeHtml(senderName)}
                </div>
                <div class="message-bubble">${escapeHtml(msg.message)}</div>
                <div class="message-time">${time}</div>
            </div>
        `;
    }
    container.innerHTML = html;
    
    // Auto scroll to bottom
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 100);
}

// ============ SEND MESSAGE ============
async function sendChatMessage() {
    const input = document.getElementById('chatMessageInput');
    const message = input.value.trim();
    const sendBtn = document.getElementById('chatSendBtn');
    
    if (!message) return;
    
    if (currentChatUser === 'guest' || !currentChatUserId) {
        showChatNotification("Please login to send messages", true);
        return;
    }
    
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
        } else {
            showChatNotification(data.error || "Failed to send", true);
        }
    } catch (error) {
        console.error('Send error:', error);
        showChatNotification("Connection error. Please try again.", true);
    } finally {
        input.disabled = false;
        sendBtn.disabled = false;
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
            `;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2500);
        }
    } catch(e) {
        console.log('Toast error:', e);
    }
}

// ============ ESCAPE HTML ============
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
            loadChatMessages();
        }
    }
}

// ============ SETUP REALTIME (Supabase) ============
function setupRealtimeChat() {
    if (chatSubscription) return;
    
    chatSubscription = supabaseClient
        .channel('chat_messages_realtime')
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'chat_messages' },
            (payload) => {
                const newMsg = payload.new;
                if (newMsg) {
                    loadChatMessages();
                }
            }
        )
        .subscribe();
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
    getCurrentUserInfo();
    await loadChatMessages();
    setupRealtimeChat();
    setupKeyboardShortcuts();
    
    // Refresh messages every 10 seconds as fallback
    setInterval(() => {
        const container = document.querySelector('.chat-widget-container');
        if (container && !container.classList.contains('minimized')) {
            loadChatMessages();
        }
    }, 10000);
}

// ============ START ============
document.addEventListener('DOMContentLoaded', initChat);

// Expose functions globally
window.sendChatMessage = sendChatMessage;
window.toggleChat = toggleChat;
window.loadChatMessages = loadChatMessages;
