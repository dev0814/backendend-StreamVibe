const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { cloudinary } = require('../config/cloudinary');

// Helper function to generate JWT token
const generateToken = (id) => {
  try {
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not defined in environment variables');
      throw new Error('JWT_SECRET is not configured');
    }

    console.log('Generating token for user ID:', id);
    const token = jwt.sign({ id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '30d'
    });
    console.log('Token generated successfully');
    return token;
  } catch (error) {
    console.error('Error generating token:', error);
    throw error;
  }
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    console.log('Registration data received:', req.body);
    const { name, email, password, role, branch, department, year } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({
        success: false,
        error: 'User already exists'
      });
    }

    // Handle profile picture upload if provided
    let profilePictureUrl = 'default-profile.jpg';
    
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'streamvibe/profiles',
        width: 200,
        crop: "scale"
      });
      
      console.log('Profile picture uploaded to Cloudinary:', {
        url: result.secure_url,
        publicId: result.public_id,
        size: result.bytes
      });
      
      profilePictureUrl = result.secure_url;
    }

    // Create user with different fields based on role
    const userData = {
      name,
      email,
      password,
      role,
      profilePicture: profilePictureUrl,
      isApproved: role === 'student' // Students are auto-approved, teachers need admin approval
    };

    // Add role-specific fields
    if (role === 'student') {
      userData.branch = branch;
      userData.year = year;
    } else if (role === 'teacher') {
      userData.department = department;
    }

    // Create user
    const user = await User.create(userData);

    // Generate JWT token
    const token = generateToken(user._id);

    // Remove password from response
    user.password = undefined;

    res.status(201).json({
      success: true,
      token,
      user,
      message: role === 'teacher' 
        ? 'Registration successful. Please wait for admin approval before you can upload videos.' 
        : 'Registration successful'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    console.log('Login attempt:', { email: req.body.email });
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password'
      });
    }

    // Check for user and explicitly select password field
    console.log('Finding user by email:', email);
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      console.log('User not found:', email);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    try {
      // Check if password matches
      console.log('Comparing passwords for user:', email);
      const isMatch = await user.matchPassword(password);

      if (!isMatch) {
        console.log('Password mismatch for user:', email);
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Check if user is approved
      if (!user.isApproved) {
        console.log('User not approved:', email);
        return res.status(403).json({
          success: false,
          error: 'Your account is pending approval. Please wait for admin approval.'
        });
      }

      // Generate JWT token
      console.log('Generating token for user:', email);
      const token = generateToken(user._id);

      // Remove password from response
      user.password = undefined;

      console.log('Login successful for user:', email);
      res.status(200).json({
        success: true,
        token,
        user
      });
    } catch (error) {
      console.error('Password comparison error:', error);
      return res.status(500).json({
        success: false,
        error: 'Error comparing passwords'
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred during login. Please try again.'
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
      user
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/updateprofile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;

    const updateFields = {
      name,
      email
    };

    // Handle profile picture upload if provided
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'streamvibe/profiles',
        width: 200,
        crop: "scale"
      });
      
      updateFields.profilePicture = result.secure_url;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateFields,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isMatch = await user.matchPassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    user.password = newPassword;
    await user.save();

    // Generate new token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      message: 'Password updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Check Cloudinary uploads for the user
// @route   GET /api/auth/check-uploads
// @access  Private
exports.checkCloudinaryUploads = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if profile picture is from Cloudinary
    const isCloudinaryImage = user.profilePicture && 
                             user.profilePicture.includes('cloudinary.com') &&
                             user.profilePicture.includes('streamvibe/profiles');

    res.status(200).json({
      success: true,
      profilePicture: user.profilePicture,
      isUsingCloudinary: isCloudinaryImage,
      message: isCloudinaryImage 
        ? 'Profile picture is stored on Cloudinary' 
        : 'Profile picture is not using Cloudinary'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};
