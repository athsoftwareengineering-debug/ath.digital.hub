// ==================== NOTIFICATION COMPONENT ====================
// ဒီဖိုင်က notification bell အတွက် သီးသန့်ဖြစ်ပါတယ်
// admin.html မှာ ဒီ script ကို ထည့်သွင်းပေးရန်လိုအပ်ပါသည်။

class NotificationManager {
    constructor(apiBase) {
        this.API_BASE = apiBase;
        this.notifications = [];
        this.unreadCount = 0;
        this.isOpen = false;
        this.autoRefreshInterval = null;
        this.lastNotificationId = null;
    }

    // Load notifications from database
    async loadNotifications() {
        try {
            const res = await fetch(`${this.API_BASE}/api/admin/notifications`, {
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (res.status === 401) {
                console.log('Not authenticated, skipping notification load');
                return false;
            }
            
            if (!res.ok) throw new Error('Failed to load notifications');
            const data = await res.json();
            
            if (data.success && data.notifications) {
                this.notifications = data.notifications;
                this.updateUnreadCount();
                this.render();
                
                if (this.notifications.length > 0 && !this.lastNotificationId) {
                    this.lastNotificationId = this.notifications[0].id;
                }
                return true;
            }
        } catch(e) {
            console.error('Error loading notifications:', e);
        }
        return false;
    }

    // Check for new notifications
    async checkForNew() {
        try {
            const res = await fetch(`${this.API_BASE}/api/admin/notifications`, {
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (res.status === 401) return;
            if (!res.ok) throw new Error('Failed to check notifications');
            
            const data = await res.json();
            
            if (data.success && data.notifications && data.notifications.length > 0) {
                const latest = data.notifications[0];
                
                if (this.lastNotificationId && this.lastNotificationId !== latest.id) {
                    this.showToast(`🔔 ${latest.title}`);
                    this.notifications = data.notifications;
                    this.updateUnreadCount();
                    this.render();
                    this.playSound();
                }
                
                this.lastNotificationId = latest.id;
                this.notifications = data.notifications;
                this.updateUnreadCount();
                this.render();
            }
        } catch(e) {
            console.error('Error checking notifications:', e);
        }
    }

    // Update unread count
    updateUnreadCount() {
        this.unreadCount = this.notifications.filter(n => !n.is_read).length;
        this.updateBadge();
    }

    // Update badge in UI
    updateBadge() {
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.style.display = 'flex';
                badge.innerText = this.unreadCount > 99 ? '99+' : this.unreadCount;
            } else {
                badge.style.display = 'none';
            }
        }
    }

    // Play notification sound (optional - silent if not supported)
    playSound() {
        try {
            // Create a silent beep - most browsers block auto-play
            // This is optional and won't break functionality
            console.log('New notification received');
        } catch(e) {}
    }

    // Show toast message
    showToast(msg, isError = false) {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = msg;
            toast.style.background = isError ? '#f43f5e' : '#10b981';
            toast.style.display = 'block';
            setTimeout(() => {
                toast.style.display = 'none';
            }, 2500);
        } else {
            console.log(msg);
        }
    }

    // Clear all notifications
    async clearAll() {
        console.log("Clearing all notifications...");
        try {
            const res = await fetch(`${this.API_BASE}/api/admin/notifications/clear`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            
            const data = await res.json();
            
            if (data.success) {
                this.notifications = [];
                this.updateUnreadCount();
                this.render();
                this.showToast('✅ All notifications cleared');
                this.closeDropdown();
                return true;
            } else {
                this.showToast('❌ Failed to clear notifications', true);
            }
        } catch(e) {
            console.error('Error clearing notifications:', e);
            this.showToast('Error clearing notifications', true);
        }
        return false;
    }

    // Delete single notification
    async deleteNotification(id) {
        console.log("Deleting notification:", id);
        try {
            const res = await fetch(`${this.API_BASE}/api/admin/notifications/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            const data = await res.json();
            
            if (data.success) {
                this.notifications = this.notifications.filter(n => n.id !== id);
                this.updateUnreadCount();
                this.render();
                this.showToast('Notification deleted');
                return true;
            } else {
                this.showToast('❌ Failed to delete notification', true);
            }
        } catch(e) {
            console.error('Error deleting notification:', e);
            this.showToast('Error deleting notification', true);
        }
        return false;
    }

    // Mark as read
    async markAsRead(id) {
        console.log("Marking notification as read:", id);
        try {
            const res = await fetch(`${this.API_BASE}/api/admin/notifications/${id}/read`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            
            const data = await res.json();
            
            if (data.success) {
                const notif = this.notifications.find(n => n.id === id);
                if (notif && !notif.is_read) {
                    notif.is_read = true;
                    this.updateUnreadCount();
                    this.render();
                    this.showToast('Marked as read');
                }
                return true;
            }
        } catch(e) {
            console.error('Error marking as read:', e);
        }
        return false;
    }

    // Mark all as read
    async markAllAsRead() {
        try {
            const res = await fetch(`${this.API_BASE}/api/admin/notifications/read-all`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            
            const data = await res.json();
            
            if (data.success) {
                this.notifications.forEach(n => n.is_read = true);
                this.updateUnreadCount();
                this.render();
                this.showToast('✅ All marked as read');
                return true;
            }
        } catch(e) {
            console.error('Error marking all as read:', e);
        }
        return false;
    }

    // Toggle dropdown
    toggleDropdown() {
        const dropdown = document.getElementById('notificationDropdown');
        const overlay = document.getElementById('notificationOverlay');
        
        if (dropdown) {
            this.isOpen = !this.isOpen;
            if (this.isOpen) {
                dropdown.classList.add('show');
                if (overlay) overlay.classList.add('show');
                this.loadNotifications();
            } else {
                dropdown.classList.remove('show');
                if (overlay) overlay.classList.remove('show');
            }
        }
    }

    // Close dropdown
    closeDropdown() {
        const dropdown = document.getElementById('notificationDropdown');
        const overlay = document.getElementById('notificationOverlay');
        
        if (dropdown) {
            this.isOpen = false;
            dropdown.classList.remove('show');
            if (overlay) overlay.classList.remove('show');
        }
    }

    // Format time (relative)
    formatTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        
        return date.toLocaleDateString();
    }

    // Escape HTML
    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    // Render notifications list
    render() {
        const container = document.getElementById('notificationList');
        if (!container) return;

        if (this.notifications.length === 0) {
            container.innerHTML = '<div class="notification-empty">📭 No notifications yet</div>';
            return;
        }

        let html = '';
        for (const notif of this.notifications) {
            html += `
                <div class="notification-item ${!notif.is_read ? 'unread' : ''}" data-id="${notif.id}">
                    <div class="notification-icon"><i class="fas fa-shopping-cart"></i></div>
                    <div class="notification-content">
                        <div class="notification-title">${this.escapeHtml(notif.title)}</div>
                        <div class="notification-message">${this.escapeHtml(notif.message)}</div>
                        <div class="notification-time"><i class="fas fa-clock"></i> ${this.formatTime(notif.created_at)}</div>
                    </div>
                    <button class="notification-delete" data-id="${notif.id}" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }
        container.innerHTML = html;
        
        // Attach event listeners to dynamically created elements
        this.attachItemEventListeners();
    }
    
    // Attach event listeners to notification items
    attachItemEventListeners() {
        // Mark as read on content click
        const contentItems = document.querySelectorAll('.notification-content');
        contentItems.forEach(item => {
            const parentDiv = item.closest('.notification-item');
            const id = parentDiv?.getAttribute('data-id');
            if (id && !item.hasAttribute('data-listener')) {
                item.setAttribute('data-listener', 'true');
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.markAsRead(parseInt(id));
                });
            }
        });
        
        // Delete button clicks
        const deleteBtns = document.querySelectorAll('.notification-delete');
        deleteBtns.forEach(btn => {
            const id = btn.getAttribute('data-id');
            if (id && !btn.hasAttribute('data-listener')) {
                btn.setAttribute('data-listener', 'true');
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deleteNotification(parseInt(id));
                });
            }
        });
    }

    // Start auto refresh (every 15 seconds)
    startAutoRefresh() {
        if (this.autoRefreshInterval) clearInterval(this.autoRefreshInterval);
        this.autoRefreshInterval = setInterval(() => {
            // Only check if user is logged in
            if (localStorage.getItem('adminToken') === 'logged_in') {
                this.checkForNew();
            }
        }, 15000);
    }

    // Stop auto refresh
    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
    }

    // Initialize component
    async init() {
        // Only load if admin is logged in
        if (localStorage.getItem('adminToken') === 'logged_in') {
            await this.loadNotifications();
            this.startAutoRefresh();
        }
        
        // Setup event listeners
        const bellBtn = document.getElementById('notificationBellBtn');
        if (bellBtn) {
            bellBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown();
            });
        }

        const clearBtn = document.getElementById('clearNotificationsBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.clearAll();
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('notificationDropdown');
            const bell = document.getElementById('notificationBellBtn');
            if (dropdown && dropdown.classList.contains('show')) {
                if (!dropdown.contains(e.target) && !bell?.contains(e.target)) {
                    this.closeDropdown();
                }
            }
        });
    }

    // Cleanup
    destroy() {
        this.stopAutoRefresh();
    }
}

// Global instance
let notificationManager = null;

// Initialize when DOM is ready - but wait for admin login status
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('notificationBellBtn')) {
        notificationManager = new NotificationManager(window.location.origin);
        window.notificationManager = notificationManager;
        
        // Initialize after a short delay to allow login state to load
        setTimeout(() => {
            if (localStorage.getItem('adminToken') === 'logged_in') {
                notificationManager.init();
            }
        }, 500);
    }
});

// Export for use in admin.html
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationManager;
}
