// routes/admin-sales-hours.js
const express = require('express');
const router = express.Router();

// ============ MIDDLEWARE ကို မှန်ကန်စွာ Import လုပ်ပါ ============
// ဒီနေရာက အရေးကြီးဆုံးပါ။ canPlaceOrder ကို မှန်ကန်စွာ import လုပ်ပါ။
const { salesHours, canPlaceOrder, getStatusMessage } = require('../middleware/salesHours.js');

// ============ AUTHENTICATION MIDDLEWARE ============
function isAuthenticated(req, res, next) {
    if (req.session && req.session.isAdmin) {
        next();
    } else {
        res.status(401).json({ success: false, error: 'Unauthorized' });
    }
}

// ============ GET SALES HOURS (Admin) ============
router.get('/admin/sales-hours', isAuthenticated, (req, res) => {
    try {
        res.json({ 
            success: true, 
            salesHours: salesHours 
        });
    } catch (error) {
        console.error('Error getting sales hours:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ============ UPDATE SALES HOURS (Admin) ============
router.post('/admin/sales-hours', isAuthenticated, (req, res) => {
    try {
        const { enabled, mode, startHour, endHour, manualStatus } = req.body;
        
        // Update sales hours
        if (enabled !== undefined) salesHours.enabled = enabled;
        if (mode !== undefined && (mode === 'auto' || mode === 'manual')) {
            salesHours.mode = mode;
        }
        if (startHour !== undefined && startHour >= 0 && startHour <= 23) {
            salesHours.startHour = startHour;
        }
        if (endHour !== undefined && endHour >= 0 && endHour <= 23) {
            salesHours.endHour = endHour;
        }
        if (manualStatus !== undefined) salesHours.manualStatus = manualStatus;
        
        console.log('✅ Sales hours updated:', salesHours);
        
        res.json({ 
            success: true, 
            salesHours: salesHours 
        });
    } catch (error) {
        console.error('Error updating sales hours:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ============ GET SALES STATUS (Public) ============
router.get('/sales/status', (req, res) => {
    try {
        // canPlaceOrder က function ဖြစ်တဲ့အတွက် () ထည့်ပြီး ခေါ်ပါ
        const isOpen = canPlaceOrder();
        const message = getStatusMessage();
        
        res.json({ 
            success: true, 
            isOpen: isOpen, 
            mode: salesHours.mode,
            startHour: salesHours.startHour,
            endHour: salesHours.endHour,
            manualStatus: salesHours.manualStatus,
            message: message 
        });
    } catch (error) {
        console.error('Error getting sales status:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ============ TOGGLE SHOP (Admin) ============
router.post('/admin/toggle-shop', isAuthenticated, (req, res) => {
    try {
        const { isOpen } = req.body;
        
        if (salesHours.mode === 'manual') {
            salesHours.manualStatus = isOpen;
            console.log(`🔄 Shop toggled to: ${isOpen ? 'OPEN' : 'CLOSED'}`);
            res.json({ 
                success: true, 
                isOpen: isOpen,
                mode: salesHours.mode,
                message: isOpen ? '🟢 ဆိုင်ဖွင့်ထားပါသည်။' : '🔴 ဆိုင်ပိတ်ထားပါသည်။'
            });
        } else {
            res.status(400).json({ 
                success: false, 
                error: 'Auto mode မှာ manual toggle မရပါ။ Auto mode ကနေ Manual mode ကိုပြောင်းပါ။' 
            });
        }
    } catch (error) {
        console.error('Error toggling shop:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ============ GET CURRENT STATUS (Public) ============
router.get('/shop/status', (req, res) => {
    try {
        const isOpen = canPlaceOrder();
        res.json({ 
            success: true, 
            isOpen: isOpen,
            mode: salesHours.mode,
            message: getStatusMessage()
        });
    } catch (error) {
        console.error('Error getting shop status:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router;

console.log('✅ admin-sales-hours.js loaded successfully!');
