const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { videoUpload, thumbnailUpload } = require('../middleware/upload');
const {
  getVideos,
  getVideo,
  createVideo,
  updateVideo,
  deleteVideo,
  likeVideo,
  unlikeVideo,
  addComment,
  removeComment,
  getVideoComments,
  uploadVideo,
  uploadThumbnail,
  getWatchHistory,
  getVideoSubjects,
  proxyVideo,
  getLikes,
} = require('../controllers/videoController');

// Public routes - accessible without authentication
router.get('/', getVideos);

// Special routes that should come BEFORE the :id route to avoid confusion
router.get('/history', protect, getWatchHistory);
router.get('/subjects', getVideoSubjects);

// Add proxy route for video streaming - THIS WAS MISSING
router.get('/proxy/:id', proxyVideo);
// Add OPTIONS handler for proxy endpoint
router.options('/proxy/:id', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range, Origin, Referer');
  res.status(204).send();
});

// Dynamic ID routes need to come AFTER specific routes
router.get('/:id', getVideo);
router.get('/:id/comments', getVideoComments);
router.get('/:id/likes', protect, getLikes);

// Protected routes - require authentication
router.use(protect);

// Teacher routes - require teacher or admin role
router.post('/upload', authorize('teacher', 'admin'), videoUpload, uploadVideo);
router.post('/thumbnail', authorize('teacher', 'admin'), thumbnailUpload, uploadThumbnail);
router.post('/', authorize('teacher', 'admin'), createVideo);
router.put('/:id', authorize('teacher', 'admin'), thumbnailUpload, updateVideo);
router.delete('/:id', authorize('teacher', 'admin'), deleteVideo);

// User interaction routes - require authentication but no specific role
router.put('/:id/like', likeVideo);
router.put('/:id/unlike', unlikeVideo);
router.post('/:id/comments', addComment);
router.delete('/:id/comments/:commentId', removeComment);

module.exports = router; 