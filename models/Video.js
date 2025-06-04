const mongoose = require('mongoose');

const VideoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please add a description'],
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  videoUrl: {
    type: String,
    required: [true, 'Please add a video URL'],
    unique: true
  },
  thumbnailUrl: {
    type: String,
    default: 'default-thumbnail.jpg'
  },
  subject: {
    type: String,
    required: [true, 'Please add a subject']
  },
  topic: {
    type: String,
    required: [true, 'Please add a topic']
  },
  tags: [{
    type: String
  }],
  branch: {
    type: String,
    required: [true, 'Please add a branch']
  },
  year: {
    type: String,
    required: [true, 'Please add a year'],
    enum: ['1st', '2nd', '3rd', '4th']
  },
  teacher: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  duration: {
    type: Number,
    default: 0
  },
  formats: {
    type: Object
  },
  specialAccess: [{
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }],
  views: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  likesCount: {
    type: Number,
    default: 0
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for likes
VideoSchema.virtual('likes', {
  ref: 'Like',
  localField: '_id',
  foreignField: 'video',
  count: true
});

// Virtual for comments
VideoSchema.virtual('comments', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'video'
});

// Virtual for formatted duration
VideoSchema.virtual('formattedDuration').get(function() {
  if (!this || !this.duration) return '00:00';
  
  const minutes = Math.floor(this.duration / 60);
  const seconds = this.duration % 60;
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
});

// Virtual for formatted views
VideoSchema.virtual('formattedViews').get(function() {
  if (!this || typeof this.views === 'undefined') return '0';
  
  if (this.views >= 1000000) {
    return `${(this.views / 1000000).toFixed(1)}M`;
  } else if (this.views >= 1000) {
    return `${(this.views / 1000).toFixed(1)}K`;
  }
  return this.views.toString();
});

// Virtual for formatted date
VideoSchema.virtual('formattedDate').get(function() {
  if (!this || !this.createdAt) return 'Unknown date';
  
  try {
    return this.createdAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (err) {
    console.error('Error formatting date:', err);
    return 'Invalid date';
  }
});

module.exports = mongoose.model('Video', VideoSchema);