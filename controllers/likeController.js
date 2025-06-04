const Like = require('../models/Like');
const Video = require('../models/Video');
const Notification = require('../models/Notification');

// @desc    Like/Unlike video
// @route   PUT /api/videos/:id/like
// @access  Private
exports.toggleLike = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);

    if (!video) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }

    // Check access
    if (req.user.role === 'student') {
      const hasAccess = (
        video.isApproved && 
        (video.branch.includes(req.user.branch) && video.year.includes(req.user.year)) ||
        video.specialAccess.includes(req.user._id)
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'You do not have access to this video'
        });
      }
    }

    // Check if user has already liked the video
    const existingLike = await Like.findOne({
      video: req.params.id,
      user: req.user._id
    });

    if (existingLike) {
      // Unlike
      await existingLike.remove();

      res.status(200).json({
        success: true,
        data: { liked: false }
      });
    } else {
      // Like
      const like = await Like.create({
        video: req.params.id,
        user: req.user._id
      });

      // Create notification for video owner
      if (video.teacher.toString() !== req.user._id.toString()) {
        await Notification.create({
          recipient: video.teacher,
          sender: req.user._id,
          type: 'like',
          title: 'New Like',
          message: `${req.user.name} liked your video "${video.title}"`,
          data: {
            videoId: video._id
          }
        });
      }

      res.status(200).json({
        success: true,
        data: { liked: true }
      });
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get video likes
// @route   GET /api/videos/:id/likes
// @access  Private
exports.getLikes = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = 'createdAt',
      order = 'desc'
    } = req.query;

    const video = await Video.findById(req.params.id);

    if (!video) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }

    // Check access
    if (req.user.role === 'student') {
      const hasAccess = (
        video.isApproved && 
        (video.branch.includes(req.user.branch) && video.year.includes(req.user.year)) ||
        video.specialAccess.includes(req.user._id)
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'You do not have access to this video'
        });
      }
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sorting
    const sortOption = {};
    sortOption[sort] = order === 'desc' ? -1 : 1;

    const likes = await Like.find({ video: req.params.id })
      .populate('user', 'name profilePicture')
      .skip(skip)
      .limit(parseInt(limit))
      .sort(sortOption);

    const total = await Like.countDocuments({ video: req.params.id });

    // Check if current user has liked the video
    const userLike = await Like.findOne({
      video: req.params.id,
      user: req.user._id
    });

    res.status(200).json({
      success: true,
      count: likes.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      page: parseInt(page),
      userLiked: !!userLike,
      data: likes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get user's liked videos
// @route   GET /api/users/likes
// @access  Private
exports.getUserLikes = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = 'createdAt',
      order = 'desc'
    } = req.query;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sorting
    const sortOption = {};
    sortOption[sort] = order === 'desc' ? -1 : 1;

    const likes = await Like.find({ user: req.user._id })
      .populate({
        path: 'video',
        select: 'title description thumbnailUrl duration views',
        populate: {
          path: 'teacher',
          select: 'name profilePicture'
        }
      })
      .skip(skip)
      .limit(parseInt(limit))
      .sort(sortOption);

    const total = await Like.countDocuments({ user: req.user._id });

    res.status(200).json({
      success: true,
      count: likes.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      page: parseInt(page),
      data: likes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Like a video
exports.likeVideo = async (req, res) => {
  try {
    const { videoId } = req.body;
    if (!videoId) {
      return res.status(400).json({ success: false, error: 'videoId is required' });
    }
    // Ensure the video exists
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }
    // Create like (unique index prevents duplicates)
    await Like.create({ video: videoId, user: req.user._id });
    res.status(201).json({ success: true, message: 'Video liked' });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate like
      return res.status(400).json({ success: false, error: 'Already liked' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
};

// Unlike a video
exports.unlikeVideo = async (req, res) => {
  try {
    const { videoId } = req.body;
    if (!videoId) {
      return res.status(400).json({ success: false, error: 'videoId is required' });
    }
    await Like.findOneAndDelete({ video: videoId, user: req.user._id });
    res.status(200).json({ success: true, message: 'Video unliked' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get all likes for a video
exports.getLikesForVideo = async (req, res) => {
  try {
    const { videoId } = req.params;
    const likes = await Like.find({ video: videoId }).populate('user', 'name');
    res.status(200).json({ success: true, count: likes.length, data: likes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get all videos liked by the user
exports.getUserLikedVideos = async (req, res) => {
  try {
    const likes = await Like.find({ user: req.user._id }).populate('video');
    res.status(200).json({ success: true, count: likes.length, data: likes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}; 