// routes/admin-sales-hours.js
const express = require('express');
const router = express.Router();
const { salesHours, canPlaceOrder, getStatusMessage } = require('../middleware/salesHours');

function isAuthenticated(req, res, next) {
    if (req.session.isAdmin) next();
    else res.status(401).json({ success: false, error: 'Unauthorized' });
}

// Get sales hours
router.get('/admin/sales-hours', isAuthenticated, (req, res) => {
    res.json({ success: true, salesHours });
});

// Update sales hours
router.post('/admin/sales-hours', isAuthenticated, (req, res) => {
    const { enabled, mode, startHour, endHour, manualStatus } = req.body;
    if (enabled !== undefined) salesHours.enabled = enabled;
    if (mode !== undefined && (mode === 'auto' || mode === 'manual')) salesHours.mode = mode;
    if (startHour !== undefined && startHour >= 0 && startHour <= 23) salesHours.startHour = startHour;
    if (endHour !== undefined && endHour >= 0 && endHour <= 23) salesHours.endHour = endHour;
    if (manualStatus !== undefined) salesHours.manualStatus = manualStatus;
    res.json({ success: true, salesHours });
});

// Get sales status (public)
router.get('/sales/status', (req, res) => {
    res.json({ 
        success: true, 
        isOpen: canPlaceOrder(), 
        mode: salesHours.mode,
        startHour: salesHours.startHour,
        endHour: salesHours.endHour,
        manualStatus: salesHours.manualStatus,
        message: getStatusMessage() 
    });
});

module.exports = router;
