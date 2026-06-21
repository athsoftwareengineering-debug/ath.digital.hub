// public/js/sales-hours.js
async function loadSalesHours() {
    try {
        const response = await fetch('/api/admin/sales-hours', { credentials: 'include' });
        const data = await response.json();
        if (data.success) {
            document.getElementById('salesEnabled').checked = data.salesHours.enabled;
            document.getElementById('startHour').value = data.salesHours.startHour;
            document.getElementById('endHour').value = data.salesHours.endHour;
            document.getElementById('salesMode').value = data.salesHours.mode || 'auto';
            document.getElementById('manualToggle').checked = data.salesHours.manualStatus || false;
        }
    } catch(e) { console.error('Error loading sales hours:', e); }
}

async function updateSalesHours() {
    const enabled = document.getElementById('salesEnabled').checked;
    const startHour = parseInt(document.getElementById('startHour').value);
    const endHour = parseInt(document.getElementById('endHour').value);
    const mode = document.getElementById('salesMode')?.value || 'auto';
    const manualStatus = document.getElementById('manualToggle')?.checked || false;
    
    try {
        const response = await fetch('/api/admin/sales-hours', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled, startHour, endHour, mode, manualStatus }),
            credentials: 'include'
        });
        const data = await response.json();
        if (data.success) {
            showToast('✅ ရောင်းချချိန် သတ်မှတ်ချက်ကို ပြင်ဆင်ပြီးပါပြီ။');
        } else {
            showToast('❌ သတ်မှတ်ချက် မအောင်မြင်ပါ။', true);
        }
    } catch(e) { showToast('Error: ' + e.message, true); }
}

async function toggleManualShop() {
    const isOpen = document.getElementById('manualToggle').checked;
    await updateSalesHours();
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message;
        toast.style.background = isError ? '#f43f5e' : '#10b981';
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, 2500);
    }
}
