// routes/dashboardNotification.js
const express = require('express');
const router = express.Router();
const DashboardNotification = require('../models/DashboardNotification');

// POST /api/dashboardnotificationroute/notifications — save a new notification (admin)
router.post('/notifications', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const notification = new DashboardNotification({
            message: message.trim(),
            isActive: true
        });

        await notification.save();

        res.status(201).json({
            success: true,
            message: 'Notification saved successfully',
            data: notification
        });

    } catch (err) {
        console.error('Save notification error:', err);
        res.status(500).json({ error: 'Failed to save notification' });
    }
});

// POST /api/dashboardnotificationroute — backward compat
router.post('/', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const notification = new DashboardNotification({
            message: message.trim(),
            isActive: true
        });

        await notification.save();

        res.status(201).json({
            success: true,
            message: 'Notification saved successfully',
            data: notification
        });

    } catch (err) {
        console.error('Save notification error:', err);
        res.status(500).json({ error: 'Failed to save notification' });
    }
});

// GET /api/dashboardnotificationroute — fetch the latest active notification (for all users)
router.get('/', async (req, res) => {
    try {
        const notification = await DashboardNotification
            .findOne({ isActive: true })
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: notification || null
        });

    } catch (err) {
        console.error('Fetch notification error:', err);
        res.status(500).json({ error: 'Failed to fetch notification' });
    }
});

// GET /api/dashboardnotificationroute/all — fetch all notifications (admin)
router.get('/all', async (req, res) => {
    try {
        const notifications = await DashboardNotification
            .find()
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: notifications
        });

    } catch (err) {
        console.error('Fetch all notifications error:', err);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// PUT /api/dashboardnotificationroute/:id — update message (admin)
router.put('/:id', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const notification = await DashboardNotification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        notification.message = message.trim();
        await notification.save();

        res.status(200).json({
            success: true,
            message: 'Notification updated successfully',
            data: notification
        });

    } catch (err) {
        console.error('Update notification error:', err);
        res.status(500).json({ error: 'Failed to update notification' });
    }
});

// PUT /api/dashboardnotificationroute/:id/toggle — toggle isActive on/off (admin)
router.put('/:id/toggle', async (req, res) => {
    try {
        const notification = await DashboardNotification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        notification.isActive = !notification.isActive;
        await notification.save();

        res.status(200).json({
            success: true,
            message: `Notification ${notification.isActive ? 'activated' : 'deactivated'}`,
            data: notification
        });

    } catch (err) {
        console.error('Toggle notification error:', err);
        res.status(500).json({ error: 'Failed to toggle notification' });
    }
});

// DELETE /api/dashboardnotificationroute/:id — delete a notification (admin)
router.delete('/:id', async (req, res) => {
    try {
        const notification = await DashboardNotification.findByIdAndDelete(req.params.id);

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.status(200).json({
            success: true,
            message: 'Notification deleted successfully'
        });

    } catch (err) {
        console.error('Delete notification error:', err);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
});

module.exports = router;
