const express = require('express');
const router = express.Router();
const { salesHours } = require('../middleware/salesHours');

function isAuthenticated(req, res, next) {
    if (req.session.isAdmin) next();
    else res.status(401).json({ success: false, error: 'Unauthorized' });
}

// Get sales hours
router.get('/sales-hours', isAuthenticated, (req, res) => {
    res.json({ success: true, salesHours });
});

// Update sales hours
router.post('/sales-hours', isAuthenticated, (req, res) => {
    const { enabled, startHour, endHour } = req.body;
    if (enabled !== undefined) salesHours.enabled = enabled;
    if (startHour !== undefined) salesHours.startHour = startHour;
    if (endHour !== undefined) salesHours.endHour = endHour;
    res.json({ success: true, salesHours });
});

module.exports = router;
