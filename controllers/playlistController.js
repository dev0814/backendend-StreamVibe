const Playlist = require('../models/Playlist');
const Video = require('../models/Video');
const { cloudinary } = require('../config/cloudinary');
const fs = require('fs');

// @desc    Create a playlist
// @route   POST /api/playlists
// @access  Private/Teacher
exports.createPlaylist = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      branch,
      year
    } = req.body;

    // Handle cover image upload
    let coverImage = null;
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'streamvibe/playlists',
        resource_type: 'image'
      });
      coverImage = result.secure_url;
      fs.unlinkSync(req.file.path);
    }

    const playlist = await Playlist.create({
      title,
      description,
      category,
      branch,
      year,
      coverImage,
      teacher: req.user._id
    });

    res.status(201).json({
      success: true,
      data: playlist
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get all playlists
// @route   GET /api/playlists
// @access  Public
exports.getPlaylists = async (req, res) => {
  try {
    const { category, branch, year, teacher, search, page = 1, limit = 10 } = req.query;
    
    const query = {};
    
    // Filter by category
    if (category) {
      query.category = category;
    }
    
    // Filter by branch
    if (branch) {
      query.branch = branch;
    }
    
    // Filter by year
    if (year) {
      query.year = year;
    }
    
    // Filter by teacher
    if (teacher) {
      query.teacher = teacher;
    }
    
    // Search by title or description
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const playlists = await Playlist.find(query)
      .populate('teacher', 'name')
      .populate('videos.video', 'title thumbnail duration views')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
      
    const total = await Playlist.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: playlists.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      page: parseInt(page),
      data: playlists
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get single playlist
// @route   GET /api/playlists/:id
// @access  Public
exports.getPlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id)
      .populate('teacher', 'name')
      .populate('videos.video', 'title description thumbnail duration views likes');
    
    if (!playlist) {
      return res.status(404).json({
        success: false,
        error: 'Playlist not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: playlist
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Update playlist
// @route   PUT /api/playlists/:id
// @access  Private/Teacher
exports.updatePlaylist = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      branch,
      year
    } = req.body;

    let playlist = await Playlist.findById(req.params.id);

    if (!playlist) {
      return res.status(404).json({
        success: false,
        error: 'Playlist not found'
      });
    }

    // Check if user is the playlist owner
    if (playlist.teacher.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this playlist'
      });
    }

    // Handle cover image upload
    let coverImage = playlist.coverImage;
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'streamvibe/playlists',
        resource_type: 'image'
      });
      coverImage = result.secure_url;
      fs.unlinkSync(req.file.path);

      // Delete old cover image if exists
      if (playlist.coverImage) {
        const publicId = playlist.coverImage.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`streamvibe/playlists/${publicId}`);
      }
    }

    // Update playlist
    playlist = await Playlist.findByIdAndUpdate(
      req.params.id,
      {
        title,
        description,
        category,
        branch,
        year,
        coverImage,
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: playlist
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Delete playlist
// @route   DELETE /api/playlists/:id
// @access  Private/Teacher
exports.deletePlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    
    if (!playlist) {
      return res.status(404).json({
        success: false,
        error: 'Playlist not found'
      });
    }
    
    // Check if user is the playlist owner
    if (playlist.teacher.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this playlist'
      });
    }
    
    // Delete cover image if exists
    if (playlist.coverImage) {
      const publicId = playlist.coverImage.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(`streamvibe/playlists/${publicId}`);
    }

    await playlist.remove();
    
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

// @desc    Add video to playlist
// @route   PUT /api/playlists/:id/videos/:videoId
// @access  Private/Teacher
exports.addVideoToPlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    
    if (!playlist) {
      return res.status(404).json({
        success: false,
        error: 'Playlist not found'
      });
    }
    
    // Check if user is the playlist owner
    if (playlist.teacher.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to modify this playlist'
      });
    }
    
    const video = await Video.findById(req.params.videoId);
    
    if (!video) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }
    
    // Check if video is already in playlist
    if (playlist.videos.some(v => v.video.toString() === req.params.videoId)) {
      return res.status(400).json({
        success: false,
        error: 'Video already in playlist'
      });
    }
    
    // Add video to playlist
    playlist.videos.push({
      video: req.params.videoId,
      order: playlist.videos.length
    });
    
    await playlist.save();
    
    res.status(200).json({
      success: true,
      data: playlist
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Remove video from playlist
// @route   DELETE /api/playlists/:id/videos/:videoId
// @access  Private/Teacher
exports.removeVideoFromPlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    
    if (!playlist) {
      return res.status(404).json({
        success: false,
        error: 'Playlist not found'
      });
    }
    
    // Check if user is the playlist owner
    if (playlist.teacher.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to modify this playlist'
      });
    }
    
    // Remove video from playlist
    playlist.videos = playlist.videos.filter(
      v => v.video.toString() !== req.params.videoId
    );
    
    // Update order of remaining videos
    playlist.videos.forEach((video, index) => {
      video.order = index;
    });
    
    await playlist.save();
    
    res.status(200).json({
      success: true,
      data: playlist
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Reorder videos in playlist
// @route   PUT /api/playlists/:id/reorder
// @access  Private/Teacher
exports.reorderVideos = async (req, res) => {
  try {
    const { videoIds } = req.body;
    
    if (!videoIds || !Array.isArray(videoIds)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an array of video IDs'
      });
    }
    
    const playlist = await Playlist.findById(req.params.id);
    
    if (!playlist) {
      return res.status(404).json({
        success: false,
        error: 'Playlist not found'
      });
    }
    
    // Check if user is the playlist owner
    if (playlist.teacher.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to modify this playlist'
      });
    }
    
    // Update order of videos
    playlist.videos = videoIds.map((videoId, index) => ({
      video: videoId,
      order: index
    }));
    
    await playlist.save();
    
    res.status(200).json({
      success: true,
      data: playlist
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
