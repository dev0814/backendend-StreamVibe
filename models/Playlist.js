const mongoose = require('mongoose');

const PlaylistSchema = new mongoose.Schema({
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
  thumbnail: {
    type: String,
    default: 'default-playlist.jpg'
  },
  category: {
    type: String,
    required: [true, 'Please add a category'],
    enum: ['Lecture', 'Tutorial', 'Workshop', 'Seminar', 'Other']
  },
  branch: {
    type: String,
    required: [true, 'Please add a branch'],
    enum: ['CSE', 'ECE', 'EEE', 'ME', 'CE']
  },
  year: {
    type: Number,
    required: [true, 'Please add a year'],
    min: 1,
    max: 4
  },
  teacher: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  videos: [{
    video: {
      type: mongoose.Schema.ObjectId,
      ref: 'Video',
      required: true
    },
    order: {
      type: Number,
      required: true
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for video count
PlaylistSchema.virtual('videoCount').get(function() {
  return this.videos.length;
});

// Virtual for total duration
PlaylistSchema.virtual('totalDuration').get(function() {
  return this.videos.reduce((total, video) => {
    return total + (video.video.duration || 0);
  }, 0);
});

// Virtual for formatted duration
PlaylistSchema.virtual('formattedDuration').get(function() {
  const totalSeconds = this.totalDuration;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

// Virtual for formatted date
PlaylistSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

module.exports = mongoose.model('Playlist', PlaylistSchema);
