const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  comment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    required: true,
    enum: ['spam', 'harassment', 'off-topic', 'inappropriate', 'other']
  },
  details: {
    type: String,
    required: function() {
      return this.reason === 'other';
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'ignored'],
    default: 'pending'
  }
});

// Compound index to ensure a user can only report a comment once
ReportSchema.index({ comment: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Report', ReportSchema); 