const express = require('express');
const router = express.Router();
const { 
  likeVideo, 
  unlikeVideo, 
  getLikesForVideo, 
  getUserLikedVideos 
} = require('../controllers/likeController');
const { protect } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// Like a video
router.post('/', likeVideo);

// Unlike a video
router.delete('/', unlikeVideo);

// Get all likes for a video (by videoId query param)
router.get('/video/:videoId', getLikesForVideo);

// Get all videos liked by the user
router.get('/user', getUserLikedVideos);

module.exports = router; 