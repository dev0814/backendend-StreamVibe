const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  recordView,
  getViewHistory,
  getViewStats
} = require('../controllers/viewController');

// Protected routes
router.use(protect);

// View routes - changed from '/' to ensure it works with the mounting point
router.post('/', recordView);
router.get('/history', getViewHistory);
router.get('/stats/:videoId', authorize('teacher', 'admin'), getViewStats);

module.exports = router; 