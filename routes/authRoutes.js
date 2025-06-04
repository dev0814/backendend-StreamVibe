const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { profilePictureUpload } = require('../middleware/upload');
const {
  register,
  login,
  getMe,
  updateProfile,
  updatePassword,
  checkCloudinaryUploads
} = require('../controllers/authController');

// Public routes
router.post('/register', profilePictureUpload, register);
router.post('/login', login);

// Protected routes
router.get('/me', protect, getMe);
router.put('/updateprofile', protect, profilePictureUpload, updateProfile);
router.put('/updatepassword', protect, updatePassword);
router.get('/check-uploads', protect, checkCloudinaryUploads);

module.exports = router; 