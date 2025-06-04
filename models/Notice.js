const mongoose = require('mongoose');

const NoticeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  content: {
    type: String,
    required: [true, 'Please add content'],
    maxlength: [1000, 'Content cannot be more than 1000 characters']
  },
  category: {
    type: String,
    required: [true, 'Please add a category'],
    enum: ['General', 'Academic', 'Event', 'Important', 'Other']
  },
  branch: {
    type: String,
    required: [true, 'Please add a branch'],
    enum: ['CSE', 'CSE-AI', 'CSE-SF', 'ECE', 'EE', 'ME', 'CE']
  },
  year: {
    type: String,
    required: [true, 'Please add a year'],
    enum: ['1st', '2nd', '3rd', '4th']
  },
  priority: {
    type: String,
    required: [true, 'Please add priority level'],
    enum: ['low', 'normal', 'high'],
    default: 'normal'
  },
  expiration: {
    type: {
      type: String,
      required: [true, 'Please specify expiration type'],
      enum: ['date', 'duration']
    },
    date: {
      type: Date,
      required: function() {
        return this.expiration.type === 'date';
      }
    },
    duration: {
      type: String,
      required: function() {
        return this.expiration.type === 'duration';
      },
      enum: ['3 days', '7 days', '14 days', '30 days', '3 months', '6 months', '1 year', 'never']
    }
  },
  attachments: [{
    filename: String,
    originalname: String,
    url: String,
    size: Number,
    mimetype: {
      type: String,
      enum: ['application/pdf']
    }
  }],
  teacher: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for formatted date
NoticeSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Method to check if notice is expired
NoticeSchema.methods.isExpired = function() {
  if (this.expiration.type === 'date') {
    return new Date() > this.expiration.date;
  } else if (this.expiration.type === 'duration') {
    if (this.expiration.duration === 'never') return false;
    
    const durationMap = {
      '3 days': 3,
      '7 days': 7,
      '14 days': 14,
      '30 days': 30,
      '3 months': 90,
      '6 months': 180,
      '1 year': 365
    };
    
    const days = durationMap[this.expiration.duration];
    const expirationDate = new Date(this.createdAt);
    expirationDate.setDate(expirationDate.getDate() + days);
    
    return new Date() > expirationDate;
  }
  return false;
};

module.exports = mongoose.model('Notice', NoticeSchema);
