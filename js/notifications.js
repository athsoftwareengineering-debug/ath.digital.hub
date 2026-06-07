// /js/notifications.js
class NotificationManager {
    constructor(apiBase) {
        this.API_BASE = apiBase;
        this.notifications = [];
        this.unreadCount = 0;
        this.isOpen = false;
        this.autoRefreshInterval = null;
        this.lastNotificationId = null;
    }

    async loadNotifications() {
        try {
            const res = await fetch(`${this.API_BASE}/api/admin/notifications`, {
                credentials: 'include'
            });
            if (res.status === 401) return false;
            if (!res.ok) throw new Error('Failed to load');
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
        } catch(e) { console.error('Error loading notifications:', e); }
        return false;
    }

    async checkForNew() {
        try {
            const res = await fetch(`${this.API_BASE}/api/admin/notifications`, {
                credentials: 'include'
            });
            if (res.status === 401) return;
            const data = await res.json();
            if (data.success && data.notifications && data.notifications.length > 0) {
                const latest = data.notifications[0];
                if (this.lastNotificationId && this.lastNotificationId !== latest.id) {
                    this.showToast(`🔔 ${latest.title}`);
                    this.notifications = data.notifications;
                    this.updateUnreadCount();
                    this.render();
                }
                this.lastNotificationId = latest.id;
                this.notifications = data.notifications;
                this.updateUnreadCount();
                this.render();
            }
        } catch(e) { console.error('Error checking notifications:', e); }
    }

    updateUnreadCount() {
        this.unreadCount = this.notifications.filter(n => !n.is_read).length;
        this.updateBadge();
    }

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

    showToast(msg, isError = false) {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = msg;
            toast.style.background = isError ? '#f43f5e' : '#10b981';
            toast.style.display = 'block';
            setTimeout(() => { toast.style.display = 'none'; }, 2500);
        }
    }

    async clearAll() {
        console.log("Clearing all notifications...");
        try {
            const res = await fetch(`${this.API_BASE}/api/admin/notifications/clear`, {
                method: 'POST',
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

    async deleteNotification(id) {
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
            }
        } catch(e) { console.error('Error deleting:', e); }
    }

    async markAsRead(id) {
        try {
            const res = await fetch(`${this.API_BASE}/api/admin/notifications/${id}/read`, {
                method: 'PUT',
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
            }
        } catch(e) { console.error('Error marking as read:', e); }
    }

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

    closeDropdown() {
        const dropdown = document.getElementById('notificationDropdown');
        const overlay = document.getElementById('notificationOverlay');
        if (dropdown) {
            this.isOpen = false;
            dropdown.classList.remove('show');
            if (overlay) overlay.classList.remove('show');
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    render() {
        const container = document.getElementById('notificationList');
        if (!container) return;
        if (this.notifications.length === 0) {
            container.innerHTML = '<div class="notification-empty">📭 No notifications yet</div>';
            return;
        }
        let html = '';
        for (const notif of this.notifications) {
            const date = new Date(notif.created_at);
            html += `
                <div class="notification-item ${!notif.is_read ? 'unread' : ''}" data-id="${notif.id}">
                    <div class="notification-icon"><i class="fas fa-shopping-cart"></i></div>
                    <div class="notification-content">
                        <div class="notification-title">${this.escapeHtml(notif.title)}</div>
                        <div class="notification-message">${this.escapeHtml(notif.message)}</div>
                        <div class="notification-time"><i class="fas fa-clock"></i> ${date.toLocaleString()}</div>
                    </div>
                    <button class="notification-delete" data-id="${notif.id}" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }
        container.innerHTML = html;
        this.attachItemEventListeners();
    }
    
    attachItemEventListeners() {
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

    startAutoRefresh() {
        if (this.autoRefreshInterval) clearInterval(this.autoRefreshInterval);
        this.autoRefreshInterval = setInterval(() => {
            if (localStorage.getItem('adminToken') === 'logged_in') {
                this.checkForNew();
            }
        }, 15000);
    }

    async init() {
        if (localStorage.getItem('adminToken') === 'logged_in') {
            await this.loadNotifications();
            this.startAutoRefresh();
        }
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
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('notificationBellBtn')) {
        window.notificationManager = new NotificationManager(window.location.origin);
        window.notificationManager.init();
    }
});
