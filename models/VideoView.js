const mongoose = require('mongoose');

const VideoViewSchema = new mongoose.Schema({
  video: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  watchedAt: {
    type: Date,
    default: Date.now
  },
  // Optionally, store watch time, completion percentage, etc.
  watchTime: {
    type: Number,
    default: 0
  },
  completionPercentage: {
    type: Number,
    default: 0
  },
  lastPosition: {
    type: Number,
    default: 0
  }
});

// Ensure a user can have only one view record per video
VideoViewSchema.index({ video: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('VideoView', VideoViewSchema);
