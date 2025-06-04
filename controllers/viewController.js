const VideoView = require('../models/VideoView');
const Video = require('../models/Video');

// @desc    Record or update a video view
// @route   POST /api/views
// @access  Private
exports.recordView = async (req, res) => {
  try {
    const { videoId, watchTime, completionPercentage, lastPosition } = req.body;

    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: 'VideoId is required'
      });
    }

    // Find existing view or create new one
    let view = await VideoView.findOne({
      video: videoId,
      user: req.user._id
    });

    if (view) {
      // Update existing view
      view.watchTime = watchTime || view.watchTime;
      view.completionPercentage = completionPercentage || view.completionPercentage;
      view.lastPosition = lastPosition || view.lastPosition;
      view.watchedAt = Date.now();
      await view.save();
    } else {
      // Create new view
      view = await VideoView.create({
        video: videoId,
        user: req.user._id,
        watchTime: watchTime || 0,
        completionPercentage: completionPercentage || 0,
        lastPosition: lastPosition || 0
      });

      // Increment video view count
      await Video.findByIdAndUpdate(videoId, {
        $inc: { views: 1 }
      });
    }

    res.status(200).json({
      success: true,
      data: view
    });
  } catch (error) {
    console.error('Error recording view:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
};

// @desc    Get user's view history
// @route   GET /api/views/history
// @access  Private
exports.getViewHistory = async (req, res) => {
  try {
    const views = await VideoView.find({ user: req.user._id })
      .populate('video', 'title thumbnailUrl duration')
      .sort('-watchedAt');

    res.status(200).json({
      success: true,
      count: views.length,
      data: views
    });
  } catch (error) {
    console.error('Error fetching view history:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
};

// @desc    Get view statistics for a video
// @route   GET /api/views/stats/:videoId
// @access  Private/Teacher
exports.getViewStats = async (req, res) => {
  try {
    const video = await Video.findById(req.params.videoId);

    if (!video) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }

    // Check if user is video owner or admin
    if (video.teacher.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view these statistics'
      });
    }

    const views = await VideoView.find({ video: req.params.videoId });

    // Calculate statistics
    const totalViews = views.length;
    const averageWatchTime = views.reduce((acc, view) => acc + view.watchTime, 0) / totalViews || 0;
    const averageCompletion = views.reduce((acc, view) => acc + view.completionPercentage, 0) / totalViews || 0;

    // Get unique viewers count
    const uniqueViewers = new Set(views.map(view => view.user.toString())).size;

    // Get completion rate distribution
    const completionDistribution = {
      '0-25': views.filter(v => v.completionPercentage <= 25).length,
      '26-50': views.filter(v => v.completionPercentage > 25 && v.completionPercentage <= 50).length,
      '51-75': views.filter(v => v.completionPercentage > 50 && v.completionPercentage <= 75).length,
      '76-100': views.filter(v => v.completionPercentage > 75).length
    };

    res.status(200).json({
      success: true,
      data: {
        totalViews,
        uniqueViewers,
        averageWatchTime,
        averageCompletion,
        completionDistribution
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get video views
// @route   GET /api/videos/:id/views
// @access  Private/Teacher
exports.getVideoViews = async (req, res) => {
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

    // Check ownership
    if (video.teacher.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this data'
      });
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sorting
    const sortOption = {};
    sortOption[sort] = order === 'desc' ? -1 : 1;

    const views = await VideoView.find({ video: req.params.id })
      .populate('user', 'name profilePicture')
      .skip(skip)
      .limit(parseInt(limit))
      .sort(sortOption);

    const total = await VideoView.countDocuments({ video: req.params.id });

    res.status(200).json({
      success: true,
      count: views.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      page: parseInt(page),
      data: views
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get user's watch history
// @route   GET /api/users/history
// @access  Private
exports.getWatchHistory = async (req, res) => {
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

    const views = await VideoView.find({ user: req.user._id })
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

    const total = await VideoView.countDocuments({ user: req.user._id });

    res.status(200).json({
      success: true,
      count: views.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      page: parseInt(page),
      data: views
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Clear watch history
// @route   DELETE /api/users/history
// @access  Private
exports.clearWatchHistory = async (req, res) => {
  try {
    await VideoView.deleteMany({ user: req.user._id });

    res.status(200).json({
      success: true,
      message: 'Watch history cleared'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}; 