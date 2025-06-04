// Role-based authorization
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    
    next();
  };
};

// Check if user is the owner of a resource or an admin
exports.checkOwnership = (model) => async (req, res, next) => {
  try {
    const resource = await model.findById(req.params.id);
    
    if (!resource) {
      return res.status(404).json({
        success: false,
        error: 'Resource not found'
      });
    }
    
    // Check if user is the owner or an admin
    const isOwner = resource.user && resource.user.toString() === req.user.id.toString() ||
                    resource.teacher && resource.teacher.toString() === req.user.id.toString() ||
                    resource.student && resource.student.toString() === req.user.id.toString() ||
                    resource.author && resource.author.toString() === req.user.id.toString();
                    
    if (isOwner || req.user.role === 'admin') {
      req.resource = resource;
      next();
    } else {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to perform this action'
      });
    }
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
