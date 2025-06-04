const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createReport,
  getReports,
  getReportsByComment,
  updateReportStatus,
  getReportCount,
  checkUserReport,
  cancelReport,
  getUserReport
} = require('../controllers/reportController');

// Public routes
// None

// Protected routes (logged-in users)
router.post('/', protect, createReport);
router.get('/count/:commentId', protect, getReportCount);
router.get('/check/:commentId', protect, checkUserReport);
router.get('/user-report/:commentId', protect, getUserReport);
router.delete('/cancel/:commentId', protect, cancelReport);

// Admin only routes
router.get('/', protect, authorize('admin'), getReports);
router.get('/comment/:commentId', protect, authorize('admin'), getReportsByComment);
router.put('/:id', protect, authorize('admin'), updateReportStatus);

module.exports = router; 