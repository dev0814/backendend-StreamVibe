const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getPlaylists,
  getPlaylist,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  reorderVideos
} = require('../controllers/playlistController');

// Public routes
router.get('/', getPlaylists);
router.get('/:id', getPlaylist);

// Protected routes
router.use(protect);

// Teacher routes
router.post('/', authorize('teacher', 'admin'), createPlaylist);
router.put('/:id', authorize('teacher', 'admin'), updatePlaylist);
router.delete('/:id', authorize('teacher', 'admin'), deletePlaylist);

// Playlist management routes
router.put('/:id/videos/:videoId', authorize('teacher', 'admin'), addVideoToPlaylist);
router.delete('/:id/videos/:videoId', authorize('teacher', 'admin'), removeVideoFromPlaylist);
router.put('/:id/reorder', authorize('teacher', 'admin'), reorderVideos);

module.exports = router; 