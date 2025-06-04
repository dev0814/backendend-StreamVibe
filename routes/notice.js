const express = require('express');
const router = express.Router();
const { 
  createNotice, 
  getNotices, 
  getNotice, 
  updateNotice, 
  deleteNotice, 
  getMyNotices 
} = require('../controllers/noticeController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { attachmentUpload } = require('../middleware/upload');

// Protect all routes
router.use(protect);

// Get notices accessible to all authenticated users
router.get('/', getNotices);

// Teacher/Admin only routes
router.post(
  '/', 
  authorize('teacher', 'admin'), 
  attachmentUpload, 
  createNotice
);

// Get teacher's notices - must be before /:id route
router.get('/my-notices', authorize('teacher'), getMyNotices);

// Routes with ID parameter
router.get('/:id', getNotice);

router.put(
  '/:id', 
  authorize('teacher', 'admin'), 
  attachmentUpload, 
  updateNotice
);

router.delete(
  '/:id', 
  authorize('teacher', 'admin'), 
  deleteNotice
);

module.exports = router;
