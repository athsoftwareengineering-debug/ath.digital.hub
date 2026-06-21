// user-chat.js - User Chat JavaScript
(function() {
    const API_BASE = window.location.origin;
    let currentUser = null;
    let currentUsername = null;
    let currentUserId = null;
    let refreshInterval = null;
    let isMinimized = false;
    let currentMode = 'private';
    let lastMessageCount = 0;
    
    function getCurrentUserInfo() {
        currentUser = localStorage.getItem('userPhone');
        currentUsername = localStorage.getItem('userName');
        currentUserId = localStorage.getItem('userId');
        
        try {
            if (window.parent && window.parent.getCurrentUserPhone) {
                currentUser = window.parent.getCurrentUserPhone();
            }
            if (window.parent && window.parent.getCurrentUsername) {
                currentUsername = window.parent.getCurrentUsername();
            }
            if (window.parent && window.parent.getCurrentUserId) {
                currentUserId = window.parent.getCurrentUserId();
            }
        } catch(e) {
            console.log('Cannot access parent window');
        }
        
        if (!currentUser) {
            currentUser = 'guest';
            currentUsername = 'Guest User';
            currentUserId = 'guest_' + Date.now();
        }
    }
    
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
        const minutesStr = minutes < 10 ? '0' + minutes : minutes;
        return `${hours}:${minutesStr} ${ampm}`;
    }
    
    function getMyanmarDate(timestamp) {
        const date = new Date(timestamp);
        const utcTime = date.getTime();
        const myanmarOffset = 6.5 * 60 * 60 * 1000;
        const myanmarDate = new Date(utcTime + myanmarOffset);
        const months = ['ဇန်နဝါရီ', 'ဖေဖော်ဝါရီ', 'မတ်', 'ဧပြီ', 'မေ', 'ဇွန်', 'ဇူလိုင်', 'သြဂုတ်', 'စက်တင်ဘာ', 'အောက်တိုဘာ', 'နိုဝင်ဘာ', 'ဒီဇင်ဘာ'];
        return `${months[myanmarDate.getUTCMonth()]} ${myanmarDate.getUTCDate()}`;
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
                `;
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 2500);
            }
        } catch(e) {
            console.log('Toast error:', e);
        }
    }
    
    async function loadPrivateMessages() {
        const container = document.getElementById('chatMessages');
        if (!container) return;
        
        if (!currentUserId || currentUserId === 'guest_' + Date.now()) {
            container.innerHTML = '<div class="chat-loading">Please login to start chatting</div>';
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/api/chat/private/${currentUserId}?currentUserId=${currentUserId}`);
            const data = await response.json();
            
            if (data.success && data.messages && data.messages.length > 0) {
                renderMessages(data.messages, 'private');
            } else {
                container.innerHTML = '<div class="chat-loading">📭 No private messages yet. Send a message to Admin! 🔒</div>';
            }
        } catch (error) {
            console.error('Error loading private messages:', error);
            container.innerHTML = '<div class="chat-loading">Cannot connect to server</div>';
        }
    }
    
    async function loadGlobalMessages() {
        const container = document.getElementById('chatMessages');
        if (!container) return;
        
        try {
            const response = await fetch(`${API_BASE}/api/chat/messages`);
            const data = await response.json();
            
            if (data.success && data.messages && data.messages.length > 0) {
                renderMessages(data.messages, 'global');
            } else {
                container.innerHTML = '<div class="chat-loading">🌍 No global messages yet. Be the first to say hello!</div>';
            }
        } catch (error) {
            console.error('Error loading global messages:', error);
            container.innerHTML = '<div class="chat-loading">Cannot connect to server</div>';
        }
    }
    
    function renderMessages(messages, mode) {
        const container = document.getElementById('chatMessages');
        if (!container) return;
        
        let html = '';
        let lastDate = null;
        
        for (const msg of messages) {
            const myanmarTime = getMyanmarTime(msg.created_at);
            const myanmarDate = getMyanmarDate(msg.created_at);
            
            let isUser = false;
            let senderName = '';
            let modeBadge = '';
            
            if (mode === 'private') {
                isUser = (msg.sender_id === currentUserId);
                senderName = isUser ? (currentUsername || 'You') : '👑 Admin';
                modeBadge = '<span class="badge private"><i class="fas fa-lock"></i> Private</span>';
            } else {
                isUser = !msg.is_admin && msg.user_id === currentUserId;
                senderName = msg.is_admin ? '👑 Admin' : (msg.username || 'User');
                modeBadge = '<span class="badge global"><i class="fas fa-globe"></i> Global</span>';
            }
            
            if (lastDate !== myanmarDate) {
                html += `<div style="text-align:center; margin:8px 0;"><span style="background:rgba(0,212,255,0.1); padding:2px 10px; border-radius:40px; font-size:0.55rem; color:#64748b;">📅 ${myanmarDate}</span></div>`;
                lastDate = myanmarDate;
            }
            
            html += `
                <div class="chat-message ${isUser ? 'user' : 'admin'}">
                    <div class="message-sender">
                        ${isUser ? '<i class="fas fa-user"></i>' : '<i class="fas fa-shield-alt"></i>'} 
                        ${escapeHtml(senderName)} ${modeBadge}
                    </div>
                    <div class="message-bubble">${escapeHtml(msg.message)}</div>
                    <div class="message-time">🕐 ${myanmarTime}</div>
                </div>
            `;
        }
        container.innerHTML = html;
        container.scrollTop = container.scrollHeight;
    }
    
    async function sendPrivateMessage(message) {
        try {
            const response = await fetch(`${API_BASE}/api/chat/private/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sender_id: currentUserId,
                    receiver_id: 'admin',
                    sender_name: currentUsername || 'User',
                    receiver_name: 'Admin',
                    message: message
                })
            });
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error sending private message:', error);
            return { success: false, error: error.message };
        }
    }
    
    async function sendGlobalMessage(message) {
        try {
            const response = await fetch(`${API_BASE}/api/chat/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUserId,
                    username: currentUsername || 'User',
                    message: message
                })
            });
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error sending global message:', error);
            return { success: false, error: error.message };
        }
    }
    
    async function sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        const sendBtn = document.querySelector('.chat-send-btn');
        
        if (!message) return;
        
        if (currentUser === 'guest' || !currentUserId || currentUserId.startsWith('guest_')) {
            showNotification("Please login to send messages", true);
            return;
        }
        
        input.disabled = true;
        sendBtn.disabled = true;
        
        try {
            let result;
            if (currentMode === 'private') {
                result = await sendPrivateMessage(message);
            } else {
                result = await sendGlobalMessage(message);
            }
            
            if (result.success) {
                input.value = '';
                input.style.height = 'auto';
                showNotification(currentMode === 'private' ? '✅ Private message sent to Admin' : '✅ Global message sent');
                await loadMessages();
            } else {
                showNotification(result.error || "Failed to send", true);
            }
        } catch (error) {
            console.error('Send error:', error);
            showNotification("Connection error: " + error.message, true);
        } finally {
            input.disabled = false;
            sendBtn.disabled = false;
            input.focus();
        }
    }
    
    async function loadMessages() {
        if (currentMode === 'private') {
            await loadPrivateMessages();
        } else {
            await loadGlobalMessages();
        }
    }
    
    function setChatMode(mode) {
        currentMode = mode;
        const privateBtn = document.getElementById('privateModeBtn');
        const globalBtn = document.getElementById('globalModeBtn');
        const modeNote = document.getElementById('chatModeNote');
        
        if (mode === 'private') {
            privateBtn.classList.add('active');
            globalBtn.classList.remove('active');
            modeNote.innerHTML = '<i class="fas fa-lock"></i> Private message - Only you and Admin can see';
        } else {
            privateBtn.classList.remove('active');
            globalBtn.classList.add('active');
            modeNote.innerHTML = '<i class="fas fa-globe"></i> Global message - Everyone can see';
        }
        loadMessages();
    }
    
    function toggleMinimize() {
        const container = document.getElementById('chatContainer');
        if (container) {
            container.classList.toggle('minimized');
            isMinimized = container.classList.contains('minimized');
        }
    }
    
    function closeUserChat() {
        if (window.parent && window.parent.closeUserChatWidget) {
            window.parent.closeUserChatWidget();
        }
    }
    
    function setupKeyboardShortcuts() {
        const input = document.getElementById('chatInput');
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
            input.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.min(this.scrollHeight, 60) + 'px';
            });
        }
    }
    
    async function init() {
        console.log('🚀 Chat widget initializing...');
        getCurrentUserInfo();
        await loadMessages();
        setupKeyboardShortcuts();
        
        refreshInterval = setInterval(() => {
            const container = document.getElementById('chatContainer');
            if (container && !container.classList.contains('minimized')) {
                loadMessages();
            }
        }, 5000);
        
        console.log('✅ Chat widget initialized');
    }
    
    function cleanup() {
        if (refreshInterval) clearInterval(refreshInterval);
        console.log('🧹 Chat widget cleaned up');
    }
    
    // Expose functions globally
    window.sendMessage = sendMessage;
    window.toggleMinimize = toggleMinimize;
    window.closeUserChat = closeUserChat;
    window.setChatMode = setChatMode;
    window.loadMessages = loadMessages;
    
    init();
    window.addEventListener('beforeunload', cleanup);
})();
