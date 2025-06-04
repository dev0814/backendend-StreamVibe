const express = require('express');
const router = express.Router();
const { 
  getNotifications, 
  markAsRead, 
  markAllAsRead, 
  deleteNotification, 
  deleteReadNotifications 
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// Get user notifications
router.get('/', getNotifications);

// Mark all as read
router.put('/read-all', markAllAsRead);

// Delete all read notifications
router.delete('/read', deleteReadNotifications);

// Mark single notification as read
router.put('/:id', markAsRead);

// Delete single notification
router.delete('/:id', deleteNotification);

module.exports = router;
