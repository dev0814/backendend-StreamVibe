const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: ['student', 'teacher', 'admin'],
    default: 'student'
  },
  branch: {
    type: String,
    required: function() {
      return this.role === 'student';
    }
  },
  department: {
    type: String,
    required: function() {
      return this.role === 'teacher';
    }
  },
  year: {
    type: String,
    required: function() {
      return this.role === 'student';
    },
    enum: ['1st', '2nd', '3rd', '4th']
  },
  profilePicture: {
    type: String,
    default: 'default-profile.jpg'
  },
  isApproved: {
    type: Boolean,
    default: function() {
      return this.role === 'student'; // Students are approved by default, teachers need approval
    }
  },
  watchHistory: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for playlists
UserSchema.virtual('playlists', {
  ref: 'Playlist',
  localField: '_id',
  foreignField: 'user',
  justOne: false
});

// Virtual for notes (for students)
UserSchema.virtual('notes', {
  ref: 'Note',
  localField: '_id',
  foreignField: 'student',
  justOne: false
});

// Virtual for videos (for teachers)
UserSchema.virtual('videos', {
  ref: 'Video',
  localField: '_id',
  foreignField: 'teacher',
  justOne: false
});

// Encrypt password using bcrypt
UserSchema.pre('save', async function(next) {
  try {
    if (!this.isModified('password')) {
      return next();
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Sign JWT and return
UserSchema.methods.getSignedJwtToken = function() {
  try {
    return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE
    });
  } catch (error) {
    console.error('Error generating JWT token:', error);
    throw error;
  }
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
  try {
    if (!this.password) {
      throw new Error('Password field is not selected');
    }
    return await bcrypt.compare(enteredPassword, this.password);
  } catch (error) {
    console.error('Error matching password:', error);
    throw error;
  }
};

module.exports = mongoose.model('User', UserSchema);