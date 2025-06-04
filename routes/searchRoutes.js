const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  search,
  getSuggestions
} = require('../controllers/searchController');

// Search videos, playlists, and notices
router.get('/', protect, search);

// Get search suggestions
router.get('/suggestions', protect, getSuggestions);

module.exports = router; 