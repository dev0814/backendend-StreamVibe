const User = require('../models/User');
const Notification = require('../models/Notification');
const { cloudinary } = require('../config/cloudinary');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, branch, year } = req.body;

    // Check if user exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({
        success: false,
        error: 'User already exists'
      });
    }

    // Create user
    user = await User.create({
      name,
      email,
      password,
      role,
      branch,
      year
    });

    sendTokenResponse(user, 201, res);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an email and password'
      });
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    sendTokenResponse(user, 200, res);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const fieldsToUpdate = {
      name: req.body.name,
      email: req.body.email,
      branch: req.body.branch,
      year: req.body.year
    };

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Update password
// @route   PUT /api/auth/password
// @access  Private
exports.updatePassword = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    if (!(await user.matchPassword(req.body.currentPassword))) {
      return res.status(401).json({
        success: false,
        error: 'Password is incorrect'
      });
    }

    user.password = req.body.newPassword;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const token = user.getSignedJwtToken();

  const options = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true
  };

  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      token
    });
};

// @desc    Get all users (with filtering)
// @route   GET /api/users
// @access  Private/Admin
exports.getAllUsers = async (req, res) => {
  try {
    const { role, approved, search, page = 1, limit = 10 } = req.query;
    
    const query = {};
    
    // Filter by role if provided
    if (role) {
      query.role = role;
    }
    
    // Filter by approval status if provided
    if (approved !== undefined) {
      query.isApproved = approved === 'true';
      console.log('Filtering by approval status:', query.isApproved);
    }
    
    // Search by name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const users = await User.find(query)
      .select('-__v')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
      
    const total = await User.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: users.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      page: parseInt(page),
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private/Admin
exports.getSingleUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
exports.updateUser = async (req, res) => {
  try {
    const { name, email, role, branch, year, isApproved } = req.body;
    
    const updateFields = {
      name,
      email,
      role,
      branch,
      isApproved
    };
    
    // Only include year if provided and role is student
    if (role === 'student' && year) {
      updateFields.year = year;
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id, 
      updateFields,
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // If approval status changed, create notification
    if (isApproved !== undefined && isApproved !== user.isApproved) {
      await Notification.create({
        recipient: user._id,
        type: 'system_announcement',
        title: isApproved ? 'Account Approved' : 'Account Rejected',
        message: isApproved 
          ? 'Your account has been approved. You can now use all the features.' 
          : 'Your account approval has been revoked. Please contact the administrator.'
      });
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Check if trying to delete admin
    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete admin user'
      });
    }
    
    await user.deleteOne();
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Approve/Reject multiple users
// @route   PUT /api/users/approval
// @access  Private/Admin
exports.bulkApproval = async (req, res) => {
  try {
    console.log('bulkApproval request body:', req.body);
    const { userIds, isApproved } = req.body;
    
    if (!userIds || !Array.isArray(userIds)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an array of user IDs'
      });
    }
    
    // Validate each userId to ensure they exist in the database
    for (const userId of userIds) {
      try {
        const user = await User.findById(userId);
        if (!user) {
          return res.status(404).json({
            success: false,
            error: `User with ID ${userId} not found`
          });
        }
      } catch (findError) {
        console.error(`Error finding user with ID ${userId}:`, findError);
        return res.status(400).json({
          success: false,
          error: `Invalid user ID format: ${userId}`
        });
      }
    }
    
    try {
      const result = await User.updateMany(
        { _id: { $in: userIds } },
        { isApproved }
      );
      
      console.log('Update result:', result);
      
      // Create notifications for all affected users
      const notificationPromises = userIds.map(userId => {
        return Notification.create({
          recipient: userId,
          type: 'system_announcement',
          title: isApproved ? 'Account Approved' : 'Account Rejected',
          message: isApproved 
            ? 'Your account has been approved. You can now use all the features.' 
            : 'Your account approval has been revoked. Please contact the administrator.'
        });
      });
      
      await Promise.all(notificationPromises);
      
      res.status(200).json({
        success: true,
        message: `${result.modifiedCount} users ${isApproved ? 'approved' : 'rejected'} successfully`,
        modifiedCount: result.modifiedCount
      });
    } catch (updateError) {
      console.error('Error during updateMany or notifications:', updateError);
      throw updateError;
    }
  } catch (error) {
    console.error('bulkApproval error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error during bulk approval operation'
    });
  }
};
