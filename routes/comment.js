const express = require('express');
const router = express.Router();
const { 
  createComment, 
  getComments, 
  updateComment, 
  deleteComment,
  bulkAction
} = require('../controllers/commentController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

// Protect all routes
router.use(protect);

// Create a comment
router.post('/', createComment);

// Get all comments for a video (by videoId query param)
router.get('/', getComments);

// Get comments by video ID
router.get('/video/:videoId', getComments);

// Update and delete comments
router.route('/:id')
  .put(updateComment)
  .delete(deleteComment);

// Admin bulk delete
router.post('/bulk-action', authorize('admin'), bulkAction);

module.exports = router;
