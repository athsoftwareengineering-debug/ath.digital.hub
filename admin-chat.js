// ============ ADMIN PRIVATE CHAT ============
const API_BASE = window.location.origin;
let currentSelectedUser = null;
let currentSelectedUserName = null;
let currentAdminId = 'admin';
let currentAdminName = 'Admin';
let privateRefreshInterval = null;
let globalRefreshInterval = null;
let currentAdminMode = 'private';

// User list ကို load လုပ်မယ်
async function loadUserList() {
    const container = document.getElementById('userList');
    if (!container) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/chat/admin/users`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (data.success && data.users && data.users.length > 0) {
            renderUserList(data.users);
        } else {
            container.innerHTML = '<div class="loading">📭 No users have sent private messages yet.</div>';
        }
    } catch (error) {
        console.error('Error loading users:', error);
        container.innerHTML = '<div class="loading">Error loading users</div>';
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

// User ကို ရွေးပြီး private messages ကြည့်မယ်
async function selectUser(userId, username) {
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
    
    // Update active state in user list
    document.querySelectorAll('.user-item').forEach(item => item.classList.remove('active'));
    const activeItem = document.querySelector(`.user-item[onclick*="${userId}"]`);
    if (activeItem) activeItem.classList.add('active');
}

// Private messages တွေကို load လုပ်မယ်
async function loadPrivateMessages(userId) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Loading messages...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/api/chat/private/${userId}?currentUserId=admin`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (data.success && data.messages && data.messages.length > 0) {
            renderPrivateMessages(data.messages);
        } else {
            container.innerHTML = '<div class="no-selection">💬 No messages yet. Reply to start conversation!</div>';
        }
    } catch (error) {
        console.error('Error loading messages:', error);
        container.innerHTML = '<div class="no-selection">Error loading messages</div>';
    }
}

function renderPrivateMessages(messages) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    let html = '';
    for (const msg of messages) {
        const time = new Date(msg.created_at).toLocaleTimeString();
        const isAdmin = msg.sender_id === 'admin';
        const senderName = isAdmin ? '👑 Admin (You)' : (msg.sender_name || 'User');
        
        html += `
            <div class="chat-message ${isAdmin ? 'admin' : 'user'}">
                <div class="message-sender">${escapeHtml(senderName)}</div>
                <div class="message-bubble">${escapeHtml(msg.message)}</div>
                <div class="message-time">${time}</div>
            </div>
        `;
    }
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

// Private message ပို့မယ်
async function sendPrivateMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) {
        showNotification("Please type a message", true);
        return;
    }
    if (!currentSelectedUser) {
        showNotification("Please select a user first", true);
        return;
    }
    
    input.disabled = true;
    
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
            input.value = '';
            await loadPrivateMessages(currentSelectedUser);
        } else {
            showNotification(data.error || "Failed to send", true);
        }
    } catch (error) {
        console.error('Send error:', error);
        showNotification("Connection error", true);
    } finally {
        input.disabled = false;
        input.focus();
    }
}

// Global messages အတွက်
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
        container.innerHTML = '<div class="no-selection">Error loading messages</div>';
    }
}

function renderGlobalMessages(messages) {
    const container = document.getElementById('globalMessagesContainer');
    if (!container) return;
    
    let html = '';
    for (const msg of messages) {
        const time = new Date(msg.created_at).toLocaleTimeString();
        const isAdmin = msg.is_admin === true;
        const senderName = isAdmin ? '👑 Admin' : (msg.username || 'User');
        
        html += `
            <div class="chat-message ${isAdmin ? 'admin' : 'user'}">
                <div class="message-sender">${escapeHtml(senderName)}</div>
                <div class="message-bubble">${escapeHtml(msg.message)}</div>
                <div class="message-time">${time}</div>
            </div>
        `;
    }
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

async function sendGlobalMessage() {
    const input = document.getElementById('globalChatInput');
    const message = input.value.trim();
    
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
            input.value = '';
            await loadGlobalMessages();
        }
    } catch (error) {
        console.error('Send error:', error);
    }
}

function setAdminMode(mode) {
    currentAdminMode = mode;
    const privateLayout = document.getElementById('privateModeLayout');
    const globalLayout = document.getElementById('globalModeLayout');
    const privateBtn = document.getElementById('privateTabBtn');
    const globalBtn = document.getElementById('globalTabBtn');
    
    if (mode === 'private') {
        privateLayout.style.display = 'flex';
        globalLayout.style.display = 'none';
        privateBtn.classList.add('active');
        globalBtn.classList.remove('active');
        loadUserList();
        if (currentSelectedUser) loadPrivateMessages(currentSelectedUser);
    } else {
        privateLayout.style.display = 'none';
        globalLayout.style.display = 'flex';
        privateBtn.classList.remove('active');
        globalBtn.classList.add('active');
        loadGlobalMessages();
    }
}

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

// Initialize
async function init() {
    console.log('Admin Chat Initialized');
    await loadUserList();
    setAdminMode('private');
    privateRefreshInterval = setInterval(() => {
        if (currentAdminMode === 'private' && currentSelectedUser) {
            loadPrivateMessages(currentSelectedUser);
            loadUserList();
        }
    }, 5000);
    globalRefreshInterval = setInterval(() => {
        if (currentAdminMode === 'global') loadGlobalMessages();
    }, 5000);
}

init();

window.sendPrivateMessage = sendPrivateMessage;
window.sendGlobalMessage = sendGlobalMessage;
window.selectUser = selectUser;
window.setAdminMode = setAdminMode;
window.toggleMinimize = toggleMinimize;
window.closeAdminChat = closeAdminChat;
