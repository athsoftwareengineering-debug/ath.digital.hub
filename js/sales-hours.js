// public/js/sales-hours.js
async function loadSalesHours() {
    try {
        const response = await fetch('/api/admin/sales-hours', { credentials: 'include' });
        const data = await response.json();
        if (data.success) {
            document.getElementById('salesEnabled').checked = data.salesHours.enabled;
            document.getElementById('startHour').value = data.salesHours.startHour;
            document.getElementById('endHour').value = data.salesHours.endHour;
        }
    } catch(e) { console.error('Error:', e); }
}

async function updateSalesHours() {
    const enabled = document.getElementById('salesEnabled').checked;
    const startHour = parseInt(document.getElementById('startHour').value);
    const endHour = parseInt(document.getElementById('endHour').value);
    
    try {
        const response = await fetch('/api/admin/sales-hours', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled, startHour, endHour }),
            credentials: 'include'
        });
        const data = await response.json();
        if (data.success) {
            alert('✅ ရောင်းချချိန် သတ်မှတ်ချက်ကို ပြင်ဆင်ပြီးပါပြီ။');
        }
    } catch(e) { alert('Error'); }
}
