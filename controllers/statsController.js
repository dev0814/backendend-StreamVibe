const Video = require('../models/Video');
const Playlist = require('../models/Playlist');
const Notice = require('../models/Notice');
const View = require('../models/View');
const Like = require('../models/Like');
const Comment = require('../models/Comment');
const User = require('../models/User');

// @desc    Get teacher dashboard stats
// @route   GET /api/stats/teacher
// @access  Private/Teacher
exports.getTeacherStats = async (req, res) => {
  try {
    // Get total videos
    const totalVideos = await Video.countDocuments({ teacher: req.user._id });

    // Get total views
    const videos = await Video.find({ teacher: req.user._id });
    const videoIds = videos.map(v => v._id);
    const totalViews = videos.reduce((sum, video) => sum + video.views, 0);

    // Get total likes
    const totalLikes = await Like.countDocuments({ video: { $in: videoIds } });

    // Get total comments
    const totalComments = await Comment.countDocuments({ video: { $in: videoIds } });

    // Get total playlists
    const totalPlaylists = await Playlist.countDocuments({ teacher: req.user._id });

    // Get total notices
    const totalNotices = await Notice.countDocuments({ author: req.user._id });

    // Get views by category
    const viewsByCategory = await Video.aggregate([
      { $match: { teacher: req.user._id } },
      { $group: {
        _id: '$category',
        views: { $sum: '$views' }
      }},
      { $sort: { views: -1 } }
    ]);

    // Get views by month
    const viewsByMonth = await View.aggregate([
      { $match: { video: { $in: videoIds } } },
      { $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        views: { $sum: 1 }
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Get top videos
    const topVideos = await Video.find({ teacher: req.user._id })
      .sort({ views: -1 })
      .limit(5)
      .select('title views likes');

    // Get recent activity
    const recentViews = await View.find({ video: { $in: videoIds } })
      .populate('user', 'name profilePicture')
      .populate('video', 'title')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentLikes = await Like.find({ video: { $in: videoIds } })
      .populate('user', 'name profilePicture')
      .populate('video', 'title')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentComments = await Comment.find({ video: { $in: videoIds } })
      .populate('user', 'name profilePicture')
      .populate('video', 'title')
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalVideos,
          totalViews,
          totalLikes,
          totalComments,
          totalPlaylists,
          totalNotices
        },
        analytics: {
          viewsByCategory,
          viewsByMonth
        },
        topVideos,
        recentActivity: {
          views: recentViews,
          likes: recentLikes,
          comments: recentComments
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get admin dashboard stats
// @route   GET /api/stats/admin
// @access  Private/Admin
exports.getAdminStats = async (req, res) => {
  try {
    // Get total users by role
    const usersByRole = await User.aggregate([
      { $group: {
        _id: '$role',
        count: { $sum: 1 }
      }}
    ]);

    // Get total videos by status
    const videosByStatus = await Video.aggregate([
      { $group: {
        _id: '$isApproved',
        count: { $sum: 1 }
      }}
    ]);

    // Get total views by branch
    const viewsByBranch = await Video.aggregate([
      { $unwind: '$branch' },
      { $group: {
        _id: '$branch',
        views: { $sum: '$views' }
      }},
      { $sort: { views: -1 } }
    ]);

    // Get total views by year
    const viewsByYear = await Video.aggregate([
      { $unwind: '$year' },
      { $group: {
        _id: '$year',
        views: { $sum: '$views' }
      }},
      { $sort: { views: -1 } }
    ]);

    // Get views by month
    const viewsByMonth = await View.aggregate([
      { $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        views: { $sum: 1 }
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Get top teachers
    const topTeachers = await Video.aggregate([
      { $group: {
        _id: '$teacher',
        totalViews: { $sum: '$views' },
        totalVideos: { $sum: 1 }
      }},
      { $sort: { totalViews: -1 } },
      { $limit: 5 },
      { $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'teacher'
      }},
      { $unwind: '$teacher' },
      { $project: {
        name: '$teacher.name',
        profilePicture: '$teacher.profilePicture',
        totalViews: 1,
        totalVideos: 1
      }}
    ]);

    // Get top videos
    const topVideos = await Video.find()
      .sort({ views: -1 })
      .limit(5)
      .populate('teacher', 'name profilePicture')
      .select('title views likes teacher');

    // Get recent activity
    const recentViews = await View.find()
      .populate('user', 'name profilePicture')
      .populate('video', 'title')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentLikes = await Like.find()
      .populate('user', 'name profilePicture')
      .populate('video', 'title')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentComments = await Comment.find()
      .populate('user', 'name profilePicture')
      .populate('video', 'title')
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          usersByRole,
          videosByStatus
        },
        analytics: {
          viewsByBranch,
          viewsByYear,
          viewsByMonth
        },
        topTeachers,
        topVideos,
        recentActivity: {
          views: recentViews,
          likes: recentLikes,
          comments: recentComments
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get video stats
// @route   GET /api/stats/videos/:id
// @access  Private/Teacher
exports.getVideoStats = async (req, res) => {
  try {
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

    // Get views by day
    const viewsByDay = await View.aggregate([
      { $match: { video: video._id } },
      { $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        views: { $sum: 1 }
      }},
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Get views by branch
    const viewsByBranch = await View.aggregate([
      { $match: { video: video._id } },
      { $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user'
      }},
      { $unwind: '$user' },
      { $group: {
        _id: '$user.branch',
        views: { $sum: 1 }
      }},
      { $sort: { views: -1 } }
    ]);

    // Get views by year
    const viewsByYear = await View.aggregate([
      { $match: { video: video._id } },
      { $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user'
      }},
      { $unwind: '$user' },
      { $group: {
        _id: '$user.year',
        views: { $sum: 1 }
      }},
      { $sort: { views: -1 } }
    ]);

    // Get recent viewers
    const recentViewers = await View.find({ video: video._id })
      .populate('user', 'name profilePicture')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get total likes
    const totalLikes = await Like.countDocuments({ video: video._id });

    // Get total comments
    const totalComments = await Comment.countDocuments({ video: video._id });

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalViews: video.views,
          totalLikes,
          totalComments
        },
        analytics: {
          viewsByDay,
          viewsByBranch,
          viewsByYear
        },
        recentViewers
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}; 