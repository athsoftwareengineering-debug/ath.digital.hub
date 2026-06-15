// ============ ADMIN PRIVATE CHAT ============
const API_BASE = window.location.origin;
let currentSelectedUser = null;
let currentSelectedUserName = null;
let currentAdminId = 'admin';
let currentAdminName = 'Admin';
let privateRefreshInterval = null;
let globalRefreshInterval = null;
let userListRefreshInterval = null;
let currentAdminMode = 'private';

// ============ GET MYANMAR TIME ============
function getMyanmarTime(timestamp) {
    const date = new Date(timestamp);
    const utcTime = date.getTime();
    const myanmarOffset = 6.5 * 60 * 60 * 1000;
    const myanmarDate = new Date(utcTime + myanmarOffset);
    let hours = myanmarDate.getUTCHours();
    const minutes = myanmarDate.getUTCMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes.toString().padStart(2,'0')} ${ampm}`;
}

// ============ LOAD USER LIST ============
async function loadUserList() {
    const container = document.getElementById('userList');
    if (!container) {
        console.log('userList element not found');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/chat/admin/users`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        console.log('Users loaded:', data);
        
        if (data.success && data.users && data.users.length > 0) {
            renderUserList(data.users);
        } else {
            container.innerHTML = '<div class="loading">📭 No users have sent private messages yet.</div>';
        }
    } catch (error) {
        console.error('Error loading users:', error);
        container.innerHTML = '<div class="loading">⚠️ Error loading users. Make sure you are logged in as Admin.</div>';
    }
}

function renderUserList(users) {
    const container = document.getElementById('userList');
    if (!container) return;
    
    let html = '';
    for (const user of users) {
        const isActive = currentSelectedUser === user.user_id;
        html += `
            <div class="user-item ${isActive ? 'active' : ''}" onclick="selectUser('${escapeHtml(user.user_id)}', '${escapeHtml(user.username)}')">
                <div class="user-name">
                    <span><i class="fas fa-user"></i> ${escapeHtml(user.username)}</span>
                </div>
                <div class="user-id">🆔 ${escapeHtml(user.user_id)}</div>
            </div>
        `;
    }
    container.innerHTML = html;
}

// ============ SELECT USER ============
async function selectUser(userId, username) {
    console.log('Selecting user:', userId, username);
    currentSelectedUser = userId;
    currentSelectedUserName = username;
    
    const header = document.getElementById('chatMainHeader');
    if (header) {
        header.innerHTML = `
            <div class="chat-with">
                <i class="fas fa-lock"></i> Private chat with: <strong>${escapeHtml(username)}</strong>
            </div>
        `;
    }
    
    const inputContainer = document.getElementById('chatInputContainer');
    if (inputContainer) inputContainer.style.display = 'block';
    
    await loadPrivateMessages(userId);
}

// ============ LOAD PRIVATE MESSAGES ============
async function loadPrivateMessages(userId) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-pulse"></i> Loading messages...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/api/chat/private/${userId}?currentUserId=admin`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        console.log('Private messages:', data);
        
        if (data.success && data.messages && data.messages.length > 0) {
            renderPrivateMessages(data.messages);
        } else {
            container.innerHTML = '<div class="no-selection">💬 No messages yet. Reply to start conversation!</div>';
        }
    } catch (error) {
        console.error('Error loading messages:', error);
        container.innerHTML = '<div class="no-selection">⚠️ Error loading messages</div>';
    }
}

function renderPrivateMessages(messages) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    let html = '';
    let lastDate = null;
    
    for (const msg of messages) {
        const msgDate = new Date(msg.created_at).toLocaleDateString();
        const time = getMyanmarTime(msg.created_at);
        const isAdmin = msg.sender_id === 'admin';
        const senderName = isAdmin ? '👑 Admin (You)' : (msg.sender_name || 'User');
        
        if (lastDate !== msgDate) {
            html += `<div style="text-align:center; margin:10px 0;"><span style="background:rgba(0,212,255,0.1); padding:4px 12px; border-radius:40px; font-size:0.6rem;">📅 ${msgDate}</span></div>`;
            lastDate = msgDate;
        }
        
        html += `
            <div class="chat-message ${isAdmin ? 'admin' : 'user'}">
                <div class="message-sender">${escapeHtml(senderName)}</div>
                <div class="message-bubble">${escapeHtml(msg.message)}</div>
                <div class="message-time">🕐 ${time}</div>
            </div>
        `;
    }
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

// ============ SEND PRIVATE MESSAGE ============
async function sendPrivateMessage() {
    const input = document.getElementById('chatInput');
    const message = input?.value.trim();
    
    if (!message) {
        showNotification("Please type a message", true);
        return;
    }
    if (!currentSelectedUser) {
        showNotification("Please select a user first", true);
        return;
    }
    
    if (input) input.disabled = true;
    
    try {
        const response = await fetch(`${API_BASE}/api/chat/private/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                sender_id: currentAdminId,
                receiver_id: currentSelectedUser,
                sender_name: currentAdminName,
                receiver_name: currentSelectedUserName || 'User',
                message: message
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (input) input.value = '';
            await loadPrivateMessages(currentSelectedUser);
            showNotification(`✅ Sent to ${currentSelectedUserName}`);
        } else {
            showNotification(data.error || "Failed to send", true);
        }
    } catch (error) {
        console.error('Send error:', error);
        showNotification("Connection error", true);
    } finally {
        if (input) {
            input.disabled = false;
            input.focus();
        }
    }
}

// ============ GLOBAL CHAT FUNCTIONS ============
async function loadGlobalMessages() {
    const container = document.getElementById('globalMessagesContainer');
    if (!container) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/chat/messages`);
        const data = await response.json();
        
        if (data.success && data.messages) {
            renderGlobalMessages(data.messages);
        } else {
            container.innerHTML = '<div class="no-selection">🌍 No global messages yet.</div>';
        }
    } catch (error) {
        container.innerHTML = '<div class="no-selection">⚠️ Error loading messages</div>';
    }
}

function renderGlobalMessages(messages) {
    const container = document.getElementById('globalMessagesContainer');
    if (!container) return;
    
    let html = '';
    let lastDate = null;
    
    for (const msg of messages) {
        const msgDate = new Date(msg.created_at).toLocaleDateString();
        const time = getMyanmarTime(msg.created_at);
        const isAdmin = msg.is_admin === true;
        const senderName = isAdmin ? '👑 Admin' : (msg.username || 'User');
        
        if (lastDate !== msgDate) {
            html += `<div style="text-align:center; margin:10px 0;"><span style="background:rgba(0,212,255,0.1); padding:4px 12px; border-radius:40px; font-size:0.6rem;">📅 ${msgDate}</span></div>`;
            lastDate = msgDate;
        }
        
        html += `
            <div class="chat-message ${isAdmin ? 'admin' : 'user'}">
                <div class="message-sender">${escapeHtml(senderName)}</div>
                <div class="message-bubble">${escapeHtml(msg.message)}</div>
                <div class="message-time">🕐 ${time}</div>
            </div>
        `;
    }
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

async function sendGlobalMessage() {
    const input = document.getElementById('globalChatInput');
    const message = input?.value.trim();
    
    if (!message) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/chat/admin/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                user_id: currentAdminId,
                username: currentAdminName,
                message: message
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (input) input.value = '';
            await loadGlobalMessages();
            showNotification("✅ Global message sent");
        }
    } catch (error) {
        console.error('Send error:', error);
        showNotification("Error sending message", true);
    }
}

// ============ MODE SWITCH ============
function setAdminMode(mode) {
    currentAdminMode = mode;
    const privateLayout = document.getElementById('privateModeLayout');
    const globalLayout = document.getElementById('globalModeLayout');
    const privateBtn = document.getElementById('privateTabBtn');
    const globalBtn = document.getElementById('globalTabBtn');
    
    if (!privateLayout || !globalLayout) return;
    
    if (mode === 'private') {
        privateLayout.style.display = 'flex';
        globalLayout.style.display = 'none';
        if (privateBtn) privateBtn.classList.add('active');
        if (globalBtn) globalBtn.classList.remove('active');
        loadUserList();
        if (currentSelectedUser) loadPrivateMessages(currentSelectedUser);
    } else {
        privateLayout.style.display = 'none';
        globalLayout.style.display = 'flex';
        if (privateBtn) privateBtn.classList.remove('active');
        if (globalBtn) globalBtn.classList.add('active');
        loadGlobalMessages();
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

function showNotification(message, isError = false) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: ${isError ? '#f43f5e' : '#10b981'};
        color: white;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 0.7rem;
        z-index: 2000;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

function toggleMinimize() {
    const container = document.getElementById('adminChatContainer');
    if (container) container.classList.toggle('minimized');
}

function closeAdminChat() {
    if (window.parent && window.parent.closeAdminChatWidget) {
        window.parent.closeAdminChatWidget();
    }
}

// ============ INITIALIZE ============
async function init() {
    console.log('Admin Chat Initializing...');
    
    // Check if elements exist
    if (!document.getElementById('userList')) {
        console.error('Required elements not found!');
        return;
    }
    
    await loadUserList();
    setAdminMode('private');
    
    // Refresh intervals
    privateRefreshInterval = setInterval(() => {
        if (currentAdminMode === 'private' && currentSelectedUser) {
            loadPrivateMessages(currentSelectedUser);
            loadUserList();
        }
    }, 10000);
    
    globalRefreshInterval = setInterval(() => {
        if (currentAdminMode === 'global') loadGlobalMessages();
    }, 10000);
    
    console.log('Admin Chat Ready');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Cleanup
window.addEventListener('beforeunload', () => {
    if (privateRefreshInterval) clearInterval(privateRefreshInterval);
    if (globalRefreshInterval) clearInterval(globalRefreshInterval);
});

// Expose functions
window.sendPrivateMessage = sendPrivateMessage;
window.sendGlobalMessage = sendGlobalMessage;
window.selectUser = selectUser;
window.setAdminMode = setAdminMode;
window.toggleMinimize = toggleMinimize;
window.closeAdminChat = closeAdminChat;
