const mongoose = require('mongoose');

const LikeSchema = new mongoose.Schema({
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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Ensure a user can only like a video once
LikeSchema.index({ video: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Like', LikeSchema);
