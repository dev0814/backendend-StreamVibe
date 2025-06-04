const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getTeacherStats,
  getAdminStats,
  getVideoStats
} = require('../controllers/statsController');

// Get teacher dashboard stats
router.get('/teacher', protect, authorize('teacher'), getTeacherStats);

// Get admin dashboard stats
router.get('/admin', protect, authorize('admin'), getAdminStats);

// Get video stats
router.get('/videos/:id', protect, authorize('teacher', 'admin'), getVideoStats);

module.exports = router; 