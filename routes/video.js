const express = require('express');
const router = express.Router();
const { 
  uploadVideo, 
  getVideos, 
  getVideo, 
  updateVideo, 
  deleteVideo, 
  getVideoAnalytics, 
  updateSpecialAccess,
  proxyVideo
} = require('../controllers/videoController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { videoUpload, thumbnailUpload } = require('../middleware/upload');

// Video proxy route to handle CORS issues - no auth required for direct access
router.route('/proxy/:id')
  .get(proxyVideo);

// Protect all other routes
router.use(protect);

// Basic video routes
router.route('/')
  .post(authorize('teacher', 'admin'), videoUpload, uploadVideo)
  .get(getVideos);

// Individual video routes
router.route('/:id')
  .get(getVideo)
  .put(authorize('teacher', 'admin'), thumbnailUpload, updateVideo)
  .delete(authorize('teacher', 'admin'), deleteVideo);

// Video analytics
router.route('/:id/analytics')
  .get(authorize('teacher', 'admin'), getVideoAnalytics);

// Special access management (admin only)
router.route('/:id/access')
  .put(authorize('admin'), updateSpecialAccess);

module.exports = router;
