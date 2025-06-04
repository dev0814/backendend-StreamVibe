const Video = require('../models/Video');
const Playlist = require('../models/Playlist');
const Notice = require('../models/Notice');

// @desc    Search videos, playlists, and notices
// @route   GET /api/search
// @access  Private
exports.search = async (req, res) => {
  try {
    const {
      query,
      type,
      category,
      branch,
      year,
      teacher,
      page = 1,
      limit = 10,
      sort = 'createdAt',
      order = 'desc'
    } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sorting
    const sortOption = {};
    sortOption[sort] = order === 'desc' ? -1 : 1;

    // Base search query
    const searchQuery = {
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ]
    };

    // Apply filters based on user role
    if (req.user.role === 'student') {
      searchQuery.isApproved = true;
      searchQuery.$or.push(
        { branch: { $in: ['All', req.user.branch] } },
        { year: { $in: ['All', req.user.year] } },
        { specialAccess: req.user._id }
      );
    }

    // Additional filters
    if (category) {
      searchQuery.category = category;
    }

    if (branch && req.user.role !== 'student') {
      searchQuery.branch = branch;
    }

    if (year && req.user.role !== 'student') {
      searchQuery.year = year;
    }

    if (teacher) {
      searchQuery.teacher = teacher;
    }

    let results = {
      videos: [],
      playlists: [],
      notices: []
    };

    // Search videos
    if (!type || type === 'videos') {
      const videos = await Video.find(searchQuery)
        .populate('teacher', 'name profilePicture')
        .skip(skip)
        .limit(parseInt(limit))
        .sort(sortOption);

      const totalVideos = await Video.countDocuments(searchQuery);

      results.videos = {
        count: videos.length,
        total: totalVideos,
        totalPages: Math.ceil(totalVideos / parseInt(limit)),
        page: parseInt(page),
        data: videos
      };
    }

    // Search playlists
    if (!type || type === 'playlists') {
      const playlistQuery = { ...searchQuery };
      if (req.user.role === 'student') {
        playlistQuery.visibility = 'public';
      }

      const playlists = await Playlist.find(playlistQuery)
        .populate('teacher', 'name profilePicture')
        .skip(skip)
        .limit(parseInt(limit))
        .sort(sortOption);

      const totalPlaylists = await Playlist.countDocuments(playlistQuery);

      results.playlists = {
        count: playlists.length,
        total: totalPlaylists,
        totalPages: Math.ceil(totalPlaylists / parseInt(limit)),
        page: parseInt(page),
        data: playlists
      };
    }

    // Search notices
    if (!type || type === 'notices') {
      const noticeQuery = { ...searchQuery };
      if (req.user.role === 'student') {
        noticeQuery.isPublished = true;
        noticeQuery.$or.push(
          { 'targetAudience.branches': { $in: ['All', req.user.branch] } },
          { 'targetAudience.years': { $in: ['All', req.user.year] } }
        );
      }

      const notices = await Notice.find(noticeQuery)
        .populate('author', 'name profilePicture')
        .skip(skip)
        .limit(parseInt(limit))
        .sort(sortOption);

      const totalNotices = await Notice.countDocuments(noticeQuery);

      results.notices = {
        count: notices.length,
        total: totalNotices,
        totalPages: Math.ceil(totalNotices / parseInt(limit)),
        page: parseInt(page),
        data: notices
      };
    }

    res.status(200).json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get search suggestions
// @route   GET /api/search/suggestions
// @access  Private
exports.getSuggestions = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    // Base search query
    const searchQuery = {
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ]
    };

    // Apply filters based on user role
    if (req.user.role === 'student') {
      searchQuery.isApproved = true;
      searchQuery.$or.push(
        { branch: { $in: ['All', req.user.branch] } },
        { year: { $in: ['All', req.user.year] } },
        { specialAccess: req.user._id }
      );
    }

    // Get suggestions from videos
    const videoSuggestions = await Video.find(searchQuery)
      .select('title category')
      .limit(5)
      .sort({ views: -1 });

    // Get suggestions from playlists
    const playlistQuery = { ...searchQuery };
    if (req.user.role === 'student') {
      playlistQuery.visibility = 'public';
    }

    const playlistSuggestions = await Playlist.find(playlistQuery)
      .select('title category')
      .limit(5)
      .sort({ 'videos.length': -1 });

    // Get suggestions from notices
    const noticeQuery = { ...searchQuery };
    if (req.user.role === 'student') {
      noticeQuery.isPublished = true;
      noticeQuery.$or.push(
        { 'targetAudience.branches': { $in: ['All', req.user.branch] } },
        { 'targetAudience.years': { $in: ['All', req.user.year] } }
      );
    }

    const noticeSuggestions = await Notice.find(noticeQuery)
      .select('title category')
      .limit(5)
      .sort({ createdAt: -1 });

    // Combine and format suggestions
    const suggestions = [
      ...videoSuggestions.map(v => ({
        type: 'video',
        title: v.title,
        category: v.category
      })),
      ...playlistSuggestions.map(p => ({
        type: 'playlist',
        title: p.title,
        category: p.category
      })),
      ...noticeSuggestions.map(n => ({
        type: 'notice',
        title: n.title,
        category: n.category
      }))
    ];

    res.status(200).json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}; 