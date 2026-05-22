// ========== REPLACE THE ENTIRE <script> SECTION WITH THIS ==========

<script>
  // Admin password is stored on server only - NEVER hardcode in frontend
  let allOrders = [];
  let selectedOrders = new Set();
  let dailyChart, packageChart;
  let currentScreenshotUrl = null;
  let autoRefreshInterval = null;
  let isAutoRefreshOn = true;
  let refreshCount = 0;
  let isSidebarCollapsed = false;
  let pendingResetEmail = "";
  let generatedCode = "";
  
  // Helper Functions
  function copyPhoneNumber(phone, element) {
    navigator.clipboard.writeText(phone).then(() => {
      const originalText = element.innerHTML;
      element.innerHTML = '<i class="fas fa-check"></i> Copied!';
      setTimeout(() => { element.innerHTML = originalText; }, 1500);
      showNotification(`📞 ${phone} copied!`, 'success');
    }).catch(() => showNotification('Failed to copy', 'error'));
  }
  
  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    isSidebarCollapsed = !isSidebarCollapsed;
    if (isSidebarCollapsed) sidebar.classList.add('collapsed');
    else sidebar.classList.remove('collapsed');
    localStorage.setItem('sidebarCollapsed', isSidebarCollapsed);
  }
  
  function openMobileSidebar() {
    document.getElementById('sidebar').classList.add('mobile-open');
    document.getElementById('overlay').classList.add('show');
  }
  
  function closeMobileSidebar() {
    document.getElementById('sidebar').classList.remove('mobile-open');
    document.getElementById('overlay').classList.remove('show');
  }
  
  function loadSidebarState() {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved === 'true') {
      isSidebarCollapsed = true;
      document.getElementById('sidebar').classList.add('collapsed');
    }
  }
  
  function formatEnglishDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleString('en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });
  }
  
  function showNotification(msg, type = 'success') {
    const notif = document.createElement('div');
    notif.className = 'notification';
    notif.style.background = type === 'error' ? '#ef4444' : type === 'info' ? '#3b82f6' : '#22c55e';
    notif.innerHTML = `<i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'info' ? 'info-circle' : 'check-circle'}"></i> ${msg}`;
    document.body.appendChild(notif);
    notif.style.display = 'block';
    setTimeout(() => notif.remove(), 3000);
  }
  
  // Get auth token (stored after login)
  function getAuthToken() {
    return sessionStorage.getItem('adminAuthToken');
  }
  
  async function login(password) {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem('adminAuthToken', password);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }
  
  async function loadAllData() {
    await loadOrders();
    await loadCharts();
    checkExpiringSoon();
  }
  
  async function loadOrders() {
    try {
      const res = await fetch('/api/admin/orders', {
        headers: { 'x-admin-auth': getAuthToken() }
      });
      const data = await res.json();
      if (data.success) {
        allOrders = data.orders;
        renderStats(data.stats);
        applyFilters();
        if (isAutoRefreshOn) updateRefreshIndicator();
      } else if (data.message === "Unauthorized") {
        logout();
      }
    } catch(err) { console.error(err); }
  }
  
  function renderStats(stats) {
    document.getElementById('statsGrid').innerHTML = `
      <div class="stat-card"><div class="value">${stats.total}</div><div class="label">Total Orders</div></div>
      <div class="stat-card"><div class="value">${stats.pending}</div><div class="label">Pending</div></div>
      <div class="stat-card"><div class="value">${stats.paid}</div><div class="label">Paid</div></div>
      <div class="stat-card"><div class="value">${stats.approved}</div><div class="label">Active</div></div>
      <div class="stat-card"><div class="value">${stats.expired}</div><div class="label">Expired</div></div>
      <div class="stat-card"><div class="value">${(stats.revenue/1000).toFixed(0)}K</div><div class="label">Revenue (KS)</div></div>
    `;
  }
  
  function applyFilters() {
    const searchPhone = document.getElementById('searchPhone').value.toLowerCase();
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const status = document.getElementById('statusFilter').value;
    
    let filtered = [...allOrders];
    if (searchPhone) filtered = filtered.filter(o => o.phone.includes(searchPhone));
    if (status !== 'all') filtered = filtered.filter(o => o.status === status);
    if (startDate) filtered = filtered.filter(o => new Date(o.createdAt) >= new Date(startDate));
    if (endDate) filtered = filtered.filter(o => new Date(o.createdAt) <= new Date(endDate));
    
    renderOrders(filtered);
  }
  
  function renderOrders(orders) {
    const container = document.getElementById('ordersList');
    if (!orders.length) {
      container.innerHTML = '<div style="padding:2rem; text-align:center; color:var(--text-secondary);">📭 No orders found</div>';
      document.getElementById('selectAll').checked = false;
      return;
    }
    
    let html = '';
    orders.forEach(order => {
      let statusClass = '', statusText = '';
      switch(order.status) {
        case 'pending_payment': statusClass = 'status-pending'; statusText = '⏳ Pending'; break;
        case 'payment_received': statusClass = 'status-paid'; statusText = '💰 Paid'; break;
        case 'approved': statusClass = 'status-approved'; statusText = '✅ Active'; break;
        case 'rejected': statusClass = 'status-rejected'; statusText = '❌ Rejected'; break;
        case 'expired': statusClass = 'status-expired'; statusText = '⏰ Expired'; break;
      }
      
      const formattedDate = formatEnglishDate(order.createdAt);
      const isChecked = selectedOrders.has(order.id);
      
      html += `
        <div class="order-card-row">
          <div class="order-grid">
            <div class="order-checkbox-cell">
              <input type="checkbox" class="order-checkbox" value="${order.id}" ${isChecked ? 'checked' : ''} onchange="toggleOrderSelection(${order.id}, this.checked)">
            </div>
            <div class="order-id" data-label="Order ID">
              <strong>#${order.id}</strong>
            </div>
            <div class="order-package" data-label="Package">
              ${order.packageName}
            </div>
            <div class="order-phone" data-label="Phone">
              <span class="phone-number">${order.phone}</span>
              <button class="copy-phone-btn" onclick="copyPhoneNumber('${order.phone}', this)"><i class="fas fa-copy"></i> Copy</button>
            </div>
            <div class="order-price" data-label="Price">
              ${order.price.toLocaleString()} KS
            </div>
            <div class="order-status" data-label="Status">
              <span class="status-badge ${statusClass}">${statusText}</span>
              ${order.daysRemaining && order.status === 'approved' ? `<span style="font-size:0.6rem; margin-left:5px;">(${order.daysRemaining}d left)</span>` : ''}
            </div>
            <div class="order-date" data-label="Date">
              ${formattedDate}
            </div>
            <div class="order-screenshot" data-label="Screenshot">
              <button class="action-view" onclick="viewScreenshot(${order.id})"><i class="fas fa-image"></i> View</button>
            </div>
            <div class="order-actions" data-label="Actions">
              ${order.status === 'payment_received' ? `
                <button class="action-btn action-approve" onclick="updateOrder(${order.id}, 'approved')"><i class="fas fa-check"></i> Approve</button>
                <button class="action-btn action-reject" onclick="updateOrder(${order.id}, 'rejected')"><i class="fas fa-times"></i> Reject</button>
              ` : '<span style="color:#64748b;">-</span>'}
            </div>
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;
    updateSelectedCountUI();
    
    // Update select all checkbox
    const selectAll = document.getElementById('selectAll');
    if (selectAll) {
      const allCheckboxes = document.querySelectorAll('.order-checkbox');
      selectAll.checked = allCheckboxes.length > 0 && allCheckboxes.length === selectedOrders.size;
    }
  }
  
  function toggleOrderSelection(orderId, isChecked) {
    if (isChecked) {
      selectedOrders.add(orderId);
    } else {
      selectedOrders.delete(orderId);
    }
    updateSelectedCountUI();
  }
  
  function toggleSelectAll() {
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.order-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = selectAll.checked;
      const id = parseInt(cb.value);
      if (selectAll.checked) {
        selectedOrders.add(id);
      } else {
        selectedOrders.delete(id);
      }
    });
    updateSelectedCountUI();
  }
  
  function updateSelectedCountUI() {
    const bulkDiv = document.getElementById('bulkActions');
    const countSpan = document.getElementById('selectedCount');
    if (selectedOrders.size > 0) {
      bulkDiv.classList.add('show');
      countSpan.innerText = `${selectedOrders.size} selected`;
    } else {
      bulkDiv.classList.remove('show');
    }
  }
  
  function clearSelection() {
    selectedOrders.clear();
    document.querySelectorAll('.order-checkbox').forEach(cb => cb.checked = false);
    updateSelectedCountUI();
    const selectAll = document.getElementById('selectAll');
    if (selectAll) selectAll.checked = false;
  }
  
  async function bulkApprove() {
    if (!confirm(`Approve ${selectedOrders.size} orders? 30 days countdown will start.`)) return;
    let successCount = 0;
    for (let id of selectedOrders) {
      const success = await updateOrder(id, 'approved', false);
      if (success) successCount++;
    }
    showNotification(`✅ ${successCount} orders approved!`);
    await loadOrders();
    clearSelection();
  }
  
  async function bulkReject() {
    if (!confirm(`Reject ${selectedOrders.size} orders?`)) return;
    let successCount = 0;
    for (let id of selectedOrders) {
      const success = await updateOrder(id, 'rejected', false);
      if (success) successCount++;
    }
    showNotification(`❌ ${successCount} orders rejected!`);
    await loadOrders();
    clearSelection();
  }
  
  async function updateOrder(orderId, status, showMsg = true) {
    try {
      const res = await fetch('/api/admin/update-order', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'x-admin-auth': getAuthToken() 
        },
        body: JSON.stringify({ orderId, status })
      });
      const data = await res.json();
      if (data.success && showMsg) {
        showNotification(`Order #${orderId} ${status === 'approved' ? 'approved! 30 days started.' : 'rejected.'}`);
      }
      return data.success;
    } catch(err) { 
      return false; 
    }
  }
  
  async function viewScreenshot(orderId) {
    showNotification('Loading screenshot...', 'info');
    try {
      const res = await fetch(`/api/admin/order-screenshot?orderId=${orderId}`, {
        headers: { 'x-admin-auth': getAuthToken() }
      });
      const data = await res.json();
      if (data.success && data.screenshotUrl) {
        currentScreenshotUrl = data.screenshotUrl;
        document.getElementById('screenshotImg').src = currentScreenshotUrl;
        document.getElementById('screenshotModal').style.display = 'flex';
      } else {
        showNotification('No screenshot available', 'error');
      }
    } catch(err) {
      showNotification('Failed to load screenshot', 'error');
    }
  }
  
  function closeModal() {
    document.getElementById('screenshotModal').style.display = 'none';
    currentScreenshotUrl = null;
  }
  
  document.getElementById('downloadScreenshotBtn').onclick = function() {
    if (currentScreenshotUrl) {
      const a = document.createElement('a');
      a.href = currentScreenshotUrl;
      a.download = `screenshot_${new Date().getTime()}.jpg`;
      a.click();
      showNotification('Downloading screenshot...', 'success');
    } else {
      showNotification('No screenshot to download', 'error');
    }
  };
  
  function exportToCSV() {
    const searchPhone = document.getElementById('searchPhone').value;
    const status = document.getElementById('statusFilter').value;
    
    let filtered = [...allOrders];
    if (searchPhone) filtered = filtered.filter(o => o.phone.includes(searchPhone));
    if (status !== 'all') filtered = filtered.filter(o => o.status === status);
    
    const headers = ['Order ID', 'Package', 'Phone', 'Price (KS)', 'Status', 'Days Left', 'Order Date'];
    const rows = filtered.map(o => [
      o.id, o.packageName, o.phone, o.price,
      o.status === 'pending_payment' ? 'Pending' : o.status === 'payment_received' ? 'Paid' : o.status === 'approved' ? 'Active' : o.status === 'rejected' ? 'Rejected' : 'Expired',
      o.daysRemaining || '-',
      formatEnglishDate(o.createdAt)
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('CSV exported successfully!');
  }
  
  async function loadCharts() {
    const res = await fetch('/api/admin/orders', { headers: { 'x-admin-auth': getAuthToken() } });
    const data = await res.json();
    if (data.success) {
      const orders = data.orders;
      const last7Days = [];
      const dailyCounts = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        last7Days.push(dateStr);
        dailyCounts.push(orders.filter(o => o.createdAt && o.createdAt.startsWith(dateStr)).length);
      }
      if (dailyChart) dailyChart.destroy();
      const ctx1 = document.getElementById('dailyChart')?.getContext('2d');
      if (ctx1) {
        dailyChart = new Chart(ctx1, {
          type: 'line',
          data: { labels: last7Days, datasets: [{ label: 'Orders', data: dailyCounts, borderColor: '#facc15', backgroundColor: '#facc1520', fill: true, tension: 0.4 }] },
          options: { responsive: true, maintainAspectRatio: true }
        });
      }
      
      const packageRevenue = {};
      orders.forEach(o => { if (o.status === 'approved') packageRevenue[o.packageName] = (packageRevenue[o.packageName] || 0) + o.price; });
      if (packageChart) packageChart.destroy();
      const ctx2 = document.getElementById('packageChart')?.getContext('2d');
      if (ctx2) {
        packageChart = new Chart(ctx2, {
          type: 'bar',
          data: { labels: Object.keys(packageRevenue), datasets: [{ label: 'Revenue (KS)', data: Object.values(packageRevenue), backgroundColor: '#facc15', borderRadius: 8 }] },
          options: { responsive: true, maintainAspectRatio: true }
        });
      }
    }
  }
  
  function checkExpiringSoon() {
    const expiringOrders = allOrders.filter(o => o.status === 'approved' && o.daysRemaining <= 5 && o.daysRemaining > 0);
    if (expiringOrders.length > 0) {
      document.getElementById('expiringAlert').style.display = 'flex';
      document.getElementById('expiringText').innerHTML = `⚠️ ${expiringOrders.length} order(s) expiring soon! Click to view.`;
    } else {
      document.getElementById('expiringAlert').style.display = 'none';
    }
  }
  
  function showExpiringPage() {
    const expiringOrders = allOrders.filter(o => o.status === 'approved' && o.daysRemaining <= 5 && o.daysRemaining > 0);
    renderOrders(expiringOrders);
    document.getElementById('pageTitle').innerText = 'Expiring Soon';
    document.getElementById('chartsContainer').style.display = 'none';
    showNotification(`Found ${expiringOrders.length} orders expiring soon`, 'info');
  }
  
  function startAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(() => {
      if (isAutoRefreshOn) {
        loadOrders();
        refreshCount++;
        updateRefreshIndicator();
      }
    }, 30000);
  }
  
  function toggleAutoRefresh() {
    isAutoRefreshOn = !isAutoRefreshOn;
    const btn = document.getElementById('toggleAutoRefreshBtn');
    const statusBadge = document.getElementById('autoRefreshStatus');
    if (isAutoRefreshOn) {
      btn.innerHTML = '<i class="fas fa-pause"></i> Pause Auto Refresh';
      statusBadge.innerHTML = '<i class="fas fa-sync-alt"></i> Auto Refresh ON';
      statusBadge.style.borderColor = '#22c55e';
      showNotification('✅ Auto Refresh enabled', 'success');
    } else {
      btn.innerHTML = '<i class="fas fa-play"></i> Start Auto Refresh';
      statusBadge.innerHTML = '<i class="fas fa-pause"></i> Auto Refresh OFF';
      statusBadge.style.borderColor = '#ef4444';
      showNotification('⏸️ Auto Refresh disabled', 'info');
    }
    updateRefreshIndicator();
  }
  
  function updateRefreshIndicator() {
    const indicator = document.getElementById('refreshIndicator');
    if (isAutoRefreshOn) {
      indicator.innerHTML = `<i class="fas fa-sync-alt"></i> Auto refreshing every 30 seconds (${refreshCount} refreshes)`;
    } else {
      indicator.innerHTML = `<i class="fas fa-pause"></i> Auto refresh paused. Click "Start Auto Refresh" to resume.`;
    }
  }
  
  function toggleTheme() {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    showNotification(isLight ? 'Light mode enabled' : 'Dark mode enabled');
  }
  
  function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      document.body.classList.add('light-mode');
    }
  }
  
  // Settings Functions (Server-side password change)
  function openSettings() {
    document.getElementById('settingsModal').style.display = 'flex';
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    document.getElementById('resetEmail').value = '';
    document.getElementById('verificationCode').value = '';
    document.getElementById('resetNewPassword').value = '';
    document.getElementById('resetConfirmPassword').value = '';
    document.getElementById('verifySection').style.display = 'none';
    document.getElementById('changePwdMessage').style.display = 'none';
    document.getElementById('forgotMessage').style.display = 'none';
  }
  
  function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
  }
  
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabId = tab.getAttribute('data-tab');
      document.getElementById('changePasswordPanel').classList.remove('active');
      document.getElementById('forgotPasswordPanel').classList.remove('active');
      if (tabId === 'change-password') {
        document.getElementById('changePasswordPanel').classList.add('active');
      } else {
        document.getElementById('forgotPasswordPanel').classList.add('active');
      }
      document.getElementById('changePwdMessage').style.display = 'none';
      document.getElementById('forgotMessage').style.display = 'none';
      document.getElementById('verifySection').style.display = 'none';
    });
  });
  
  async function changePassword() {
    const currentPwd = document.getElementById('currentPassword').value;
    const newPwd = document.getElementById('newPassword').value;
    const confirmPwd = document.getElementById('confirmPassword').value;
    const msgDiv = document.getElementById('changePwdMessage');
    
    if (!currentPwd || !newPwd || !confirmPwd) {
      msgDiv.className = 'settings-message error';
      msgDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Please fill in all fields';
      msgDiv.style.display = 'block';
      return;
    }
    
    if (newPwd.length < 6) {
      msgDiv.className = 'settings-message error';
      msgDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> New password must be at least 6 characters';
      msgDiv.style.display = 'block';
      return;
    }
    
    if (newPwd !== confirmPwd) {
      msgDiv.className = 'settings-message error';
      msgDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> New passwords do not match';
      msgDiv.style.display = 'block';
      return;
    }
    
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-auth': getAuthToken()
        },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd })
      });
      const data = await res.json();
      
      if (data.success) {
        msgDiv.className = 'settings-message success';
        msgDiv.innerHTML = '<i class="fas fa-check-circle"></i> Password changed successfully! Please login again.';
        msgDiv.style.display = 'block';
        sessionStorage.setItem('adminAuthToken', newPwd);
        showNotification('✅ Password changed successfully!', 'success');
        setTimeout(() => logout(), 2000);
      } else {
        msgDiv.className = 'settings-message error';
        msgDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${data.message}`;
        msgDiv.style.display = 'block';
      }
    } catch (err) {
      msgDiv.className = 'settings-message error';
      msgDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Server error';
      msgDiv.style.display = 'block';
    }
  }
  
  function sendVerificationCode() {
    const email = document.getElementById('resetEmail').value.trim();
    const msgDiv = document.getElementById('forgotMessage');
    
    if (!email) {
      msgDiv.className = 'settings-message error';
      msgDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Please enter your email address';
      msgDiv.style.display = 'block';
      return;
    }
    
    if (!email.includes('@') || !email.includes('.')) {
      msgDiv.className = 'settings-message error';
      msgDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Please enter a valid email address';
      msgDiv.style.display = 'block';
      return;
    }
    
    // Generate random code
    generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
    pendingResetEmail = email;
    
    msgDiv.className = 'settings-message info';
    msgDiv.innerHTML = `<i class="fas fa-envelope"></i> Verification code sent to ${email}<br><small>Demo Code: <strong>${generatedCode}</strong></small>`;
    msgDiv.style.display = 'block';
    
    document.getElementById('verifySection').style.display = 'block';
    
    showNotification(`📧 Verification code sent to ${email}`, 'info');
  }
  
  async function resetPasswordWithCode() {
    const code = document.getElementById('verificationCode').value;
    const newPwd = document.getElementById('resetNewPassword').value;
    const confirmPwd = document.getElementById('resetConfirmPassword').value;
    const msgDiv = document.getElementById('forgotMessage');
    
    if (!code) {
      msgDiv.className = 'settings-message error';
      msgDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Please enter verification code';
      msgDiv.style.display = 'block';
      return;
    }
    
    if (code !== generatedCode) {
      msgDiv.className = 'settings-message error';
      msgDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Invalid verification code';
      msgDiv.style.display = 'block';
      return;
    }
    
    if (!newPwd || !confirmPwd) {
      msgDiv.className = 'settings-message error';
      msgDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Please enter new password';
      msgDiv.style.display = 'block';
      return;
    }
    
    if (newPwd.length < 6) {
      msgDiv.className = 'settings-message error';
      msgDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Password must be at least 6 characters';
      msgDiv.style.display = 'block';
      return;
    }
    
    if (newPwd !== confirmPwd) {
      msgDiv.className = 'settings-message error';
      msgDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Passwords do not match';
      msgDiv.style.display = 'block';
      return;
    }
    
    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingResetEmail, newPassword: newPwd, code: code })
      });
      const data = await res.json();
      
      if (data.success) {
        msgDiv.className = 'settings-message success';
        msgDiv.innerHTML = '<i class="fas fa-check-circle"></i> Password reset successfully! Please login with new password.';
        msgDiv.style.display = 'block';
        
        document.getElementById('resetEmail').value = '';
        document.getElementById('verificationCode').value = '';
        document.getElementById('resetNewPassword').value = '';
        document.getElementById('resetConfirmPassword').value = '';
        document.getElementById('verifySection').style.display = 'none';
        generatedCode = "";
        
        showNotification('✅ Password reset successfully!', 'success');
        
        setTimeout(() => {
          logout();
        }, 2000);
      } else {
        msgDiv.className = 'settings-message error';
        msgDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${data.message}`;
        msgDiv.style.display = 'block';
      }
    } catch (err) {
      msgDiv.className = 'settings-message error';
      msgDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Server error';
      msgDiv.style.display = 'block';
    }
  }
  
  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      const page = item.getAttribute('data-page');
      const chartsContainer = document.getElementById('chartsContainer');
      document.getElementById('pageTitle').innerText = page === 'dashboard' ? 'Dashboard' : page === 'orders' ? 'Orders' : page === 'expiring' ? 'Expiring Soon' : 'Analytics';
      
      if (page === 'dashboard') {
        if (chartsContainer) chartsContainer.style.display = 'grid';
        loadAllData();
      } else if (page === 'expiring') {
        if (chartsContainer) chartsContainer.style.display = 'none';
        showExpiringPage();
      } else if (page === 'orders') {
        if (chartsContainer) chartsContainer.style.display = 'none';
        applyFilters();
      } else if (page === 'analytics') {
        if (chartsContainer) chartsContainer.style.display = 'grid';
        loadCharts();
      }
      
      if (window.innerWidth <= 768) closeMobileSidebar();
    });
  });
  
  function logout() {
    sessionStorage.removeItem('adminAuthToken');
    sessionStorage.removeItem('adminLoggedIn');
    location.reload();
  }
  
  // Login Handler
  document.getElementById('loginBtn').onclick = async function() {
    const password = document.getElementById('adminPassword').value;
    const loginBtn = document.getElementById('loginBtn');
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
    
    if (await login(password)) {
      sessionStorage.setItem('adminLoggedIn', 'true');
      document.getElementById('loginSection').style.display = 'none';
      document.getElementById('dashboardSection').style.display = 'block';
      loadSidebarState();
      loadTheme();
      await loadAllData();
      startAutoRefresh();
    } else {
      const err = document.getElementById('loginError');
      err.innerText = 'Wrong password!';
      err.style.display = 'block';
      setTimeout(() => err.style.display = 'none', 2000);
    }
    
    loginBtn.disabled = false;
    loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Access Dashboard';
  };
  
  // Check login status
  if (sessionStorage.getItem('adminLoggedIn') === 'true' && sessionStorage.getItem('adminAuthToken')) {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('dashboardSection').style.display = 'block';
    loadSidebarState();
    loadTheme();
    loadAllData();
    startAutoRefresh();
  }
  
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) closeMobileSidebar();
  });
  
  // Expose functions globally
  window.copyPhoneNumber = copyPhoneNumber;
  window.toggleSidebar = toggleSidebar;
  window.openMobileSidebar = openMobileSidebar;
  window.closeMobileSidebar = closeMobileSidebar;
  window.updateOrder = updateOrder;
  window.viewScreenshot = viewScreenshot;
  window.closeModal = closeModal;
  window.applyFilters = applyFilters;
  window.exportToCSV = exportToCSV;
  window.toggleSelectAll = toggleSelectAll;
  window.toggleOrderSelection = toggleOrderSelection;
  window.clearSelection = clearSelection;
  window.bulkApprove = bulkApprove;
  window.bulkReject = bulkReject;
  window.showExpiringPage = showExpiringPage;
  window.toggleTheme = toggleTheme;
  window.toggleAutoRefresh = toggleAutoRefresh;
  window.logout = logout;
  window.openSettings = openSettings;
  window.closeSettings = closeSettings;
  window.changePassword = changePassword;
  window.sendVerificationCode = sendVerificationCode;
  window.resetPasswordWithCode = resetPasswordWithCode;
</script>
