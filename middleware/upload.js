const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = 'public/uploads/';
if (!fs.existsSync(uploadDir)){
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage for temporary file uploads (before uploading to Cloudinary)
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`);
  }
});

// Check file type
const fileFilter = (req, file, cb) => {
  // Allowed extensions
  const fileTypes = /jpeg|jpg|png|mp4|webm|mov|gif|avi|mkv|flv/;
  
  // Check extension
  const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
  
  // Check mime type
  const mimetype = file.mimetype.includes('video/') || file.mimetype.includes('image/');
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb('Error: Invalid file type. Only images, videos, and GIFs are allowed.');
  }
};

// Initialize upload variable
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max size
  },
  fileFilter: fileFilter
});

// Create middleware functions for different use cases
exports.videoUpload = upload.single('video');
exports.thumbnailUpload = upload.single('thumbnail');
exports.profilePictureUpload = upload.single('profilePicture');
exports.attachmentUpload = upload.single('attachment');
