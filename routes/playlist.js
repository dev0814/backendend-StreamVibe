const express = require('express');
const router = express.Router();
const { 
  createPlaylist, 
  getPlaylists, 
  getPlaylist, 
  updatePlaylist, 
  deletePlaylist,
  addVideoToPlaylist,
  removeVideoFromPlaylist
} = require('../controllers/playlistController');
const { protect } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// Playlist CRUD routes
router.route('/')
  .post(createPlaylist)
  .get(getPlaylists);

router.route('/:id')
  .get(getPlaylist)
  .put(updatePlaylist)
  .delete(deletePlaylist);

// Video management in playlists
router.route('/:id/videos/:videoId')
  .put(addVideoToPlaylist)
  .delete(removeVideoFromPlaylist);

module.exports = router;
