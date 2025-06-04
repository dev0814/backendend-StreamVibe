const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes
exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    // Set token from Bearer token in header
    token = req.headers.authorization.split(' ')[1];
    console.log('Token found in authorization header');
  } else {
    console.log('No authorization header or Bearer token found');
  }

  // Make sure token exists
  if (!token) {
    console.log('No token provided in request');
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decoded successfully:', {
      id: decoded.id,
      iat: decoded.iat,
      exp: decoded.exp
    });

    const user = await User.findById(decoded.id);
    
    if (!user) {
      console.log('User not found for token with ID:', decoded.id);
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }
    
    console.log('User found:', {
      id: user._id,
      email: user.email,
      role: user.role,
      isApproved: user.isApproved
    });

    // Check if user is approved
    if (!user.isApproved) {
      console.log('User not approved:', user.email);
      return res.status(403).json({
        success: false,
        error: 'Your account is pending approval. Please wait for admin approval.'
      });
    }
    
    // Set user in request object
    req.user = user;
    console.log('User set in request object');

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route'
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};
