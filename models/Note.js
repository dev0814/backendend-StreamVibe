const mongoose = require('mongoose');

const NoteSchema = new mongoose.Schema({
  title: {
    type: String,
    required: function() {
      return !this.video; // Title is required only for standalone notes
    },
    default: 'Untitled Note'
  },
  content: {
    type: String,
    required: [true, 'Please provide note content'],
    default: ''
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  video: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video',
    required: false  // Optional to allow standalone notes
  },
  timestamp: { // Timestamp in the video where the note was taken
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add virtual for formatted date
NoteSchema.virtual('formattedDate').get(function() {
  return this.updatedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Add pre-save hook to set updatedAt
NoteSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Add indexes for better performance
NoteSchema.index({ student: 1, video: 1 });
NoteSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('Note', NoteSchema);
