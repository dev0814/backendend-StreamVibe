const Comment = require('../models/Comment');
const Video = require('../models/Video');
const Notification = require('../models/Notification');

// @desc    Create comment
// @route   POST /api/videos/:videoId/comments
// @access  Private
exports.createComment = async (req, res) => {
  try {
    const { content, videoId, parentComment } = req.body;
    if (!videoId || !content) {
      return res.status(400).json({ success: false, error: 'videoId and content are required' });
    }
    // Ensure the video exists
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }
    // Create comment
    const comment = await Comment.create({
      content,
      video: videoId,
      user: req.user._id,
      parentComment: parentComment || null
    });
    res.status(201).json({ success: true, data: comment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get video comments or all comments for admin
// @route   GET /api/comments
// @access  Private
exports.getComments = async (req, res) => {
  try {
    // Get videoId from params or query
    const videoId = req.params.videoId || req.query.videoId;
    const { search, sort = 'createdAt', order = 'desc' } = req.query;
    
    // Build query
    let query = {};
    
    // If videoId is provided, filter by video
    if (videoId) {
      query.video = videoId;
    }
    
    // If search term is provided, search in content
    if (search) {
      query.content = { $regex: search, $options: 'i' };
    }
    
    // Build sort object
    const sortObj = {};
    sortObj[sort] = order === 'desc' ? -1 : 1;
    
    const comments = await Comment.find(query)
      .populate('user', 'name profileImage role')
      .populate('video', 'title _id')
      .sort(sortObj);
      
    res.status(200).json({ success: true, count: comments.length, data: comments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Update comment
// @route   PUT /api/comments/:id
// @access  Private
exports.updateComment = async (req, res) => {
  try {
    const { content } = req.body;
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }
    if (comment.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    comment.content = content;
    await comment.save();
    res.status(200).json({ success: true, data: comment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Delete comment
// @route   DELETE /api/comments/:id
// @access  Private
exports.deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }
    if (comment.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    // Check if this is a parent comment with replies
    if (!comment.parentComment) {
      // Delete all replies to this comment if it's a parent comment
      await Comment.deleteMany({ parentComment: comment._id });
    }
    
    // Delete the comment itself
    await Comment.findByIdAndDelete(req.params.id);
    
    res.status(200).json({ success: true, message: 'Comment deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Like/Unlike comment
// @route   PUT /api/comments/:id/like
// @access  Private
exports.toggleLike = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found'
      });
    }

    // Check if user has already liked the comment
    const likeIndex = comment.likes.indexOf(req.user._id);
    if (likeIndex > -1) {
      // Unlike
      comment.likes.splice(likeIndex, 1);
    } else {
      // Like
      comment.likes.push(req.user._id);

      // Create notification for comment owner
      if (comment.user.toString() !== req.user._id.toString()) {
        await Notification.create({
          recipient: comment.user,
          sender: req.user._id,
          type: 'like',
          title: 'New Like',
          message: `${req.user.name} liked your comment`,
          data: {
            videoId: comment.video,
            commentId: comment._id
          }
        });
      }
    }

    await comment.save();

    res.status(200).json({
      success: true,
      data: comment
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Bulk delete comments (admin only)
// @route   POST /api/comments/bulk-action
// @access  Private/Admin
exports.bulkAction = async (req, res) => {
  try {
    const { commentIds } = req.body;
    
    if (!commentIds || !Array.isArray(commentIds) || commentIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide an array of comment IDs' 
      });
    }
    
    // Delete comments and their replies
    await Comment.deleteMany({
      $or: [
        { _id: { $in: commentIds } },
        { parentComment: { $in: commentIds } }
      ]
    });
    
    res.status(200).json({ 
      success: true, 
      message: `Successfully deleted ${commentIds.length} comments` 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
