const Report = require('../models/Report');
const Comment = require('../models/Comment');

// @desc    Create a report for a comment
// @route   POST /api/reports
// @access  Private
exports.createReport = async (req, res) => {
  try {
    const { commentId, reason, details } = req.body;

    // Validate input
    if (!commentId || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Please provide comment ID and reason'
      });
    }

    // Check if comment exists
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found'
      });
    }

    // Check if user is trying to report their own comment
    if (comment.user.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        error: 'You cannot report your own comment'
      });
    }

    // Check if user has already reported this comment
    const existingReport = await Report.findOne({
      comment: commentId,
      user: req.user._id
    });

    if (existingReport) {
      return res.status(400).json({
        success: false,
        error: 'You have already reported this comment'
      });
    }

    // Create report
    const report = await Report.create({
      comment: commentId,
      user: req.user._id,
      reason,
      details: reason === 'other' ? details : undefined
    });

    res.status(201).json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get all reports
// @route   GET /api/reports
// @access  Private/Admin
exports.getReports = async (req, res) => {
  try {
    const { status, commentId } = req.query;
    
    // Build query
    let query = {};
    
    // Filter by status if provided
    if (status) {
      query.status = status;
    }
    
    // Filter by comment if provided
    if (commentId) {
      query.comment = commentId;
    }
    
    const reports = await Report.find(query)
      .populate('user', 'name email profilePicture')
      .populate({
        path: 'comment',
        populate: {
          path: 'user',
          select: 'name email profilePicture'
        }
      });

    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get reports by comment ID
// @route   GET /api/reports/comment/:commentId
// @access  Private/Admin
exports.getReportsByComment = async (req, res) => {
  try {
    const reports = await Report.find({ comment: req.params.commentId })
      .populate('user', 'name email profilePicture');

    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Update report status
// @route   PUT /api/reports/:id
// @access  Private/Admin
exports.updateReportStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['pending', 'reviewed', 'ignored'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status value'
      });
    }

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get report count by comment ID
// @route   GET /api/reports/count/:commentId
// @access  Private
exports.getReportCount = async (req, res) => {
  try {
    const count = await Report.countDocuments({ comment: req.params.commentId });
    
    res.status(200).json({
      success: true,
      count
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Check if user has reported a comment
// @route   GET /api/reports/check/:commentId
// @access  Private
exports.checkUserReport = async (req, res) => {
  try {
    const report = await Report.findOne({
      comment: req.params.commentId,
      user: req.user._id
    });
    
    res.status(200).json({
      success: true,
      hasReported: !!report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get a user's specific report for a comment
// @route   GET /api/reports/user-report/:commentId
// @access  Private
exports.getUserReport = async (req, res) => {
  try {
    const report = await Report.findOne({
      comment: req.params.commentId,
      user: req.user._id
    });
    
    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Cancel/delete a report made by the current user
// @route   DELETE /api/reports/cancel/:commentId
// @access  Private
exports.cancelReport = async (req, res) => {
  try {
    const { commentId } = req.params;
    
    // Find the report for this comment made by the current user
    const report = await Report.findOne({
      comment: commentId,
      user: req.user._id
    });
    
    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }
    
    // Delete the report
    await Report.findByIdAndDelete(report._id);
    
    res.status(200).json({
      success: true,
      message: 'Report successfully canceled'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}; 