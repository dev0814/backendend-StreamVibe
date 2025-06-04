const Video = require('../models/Video');
const User = require('../models/User');
const Notification = require('../models/Notification');
const VideoView = require('../models/VideoView');
const Like = require('../models/Like');
const Comment = require('../models/Comment');
const { cloudinary } = require('../config/cloudinary');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const mongoose = require('mongoose');

// Set FFmpeg and FFprobe paths
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

console.log('FFmpeg path:', ffmpegInstaller.path);
console.log('FFprobe path:', ffprobeInstaller.path);

// @desc    Upload video
// @route   POST /api/videos/upload
// @access  Private/Teacher
exports.uploadVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Please upload a video file'
      });
    }

    console.log('File received:', {
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    });

    // Get video duration
    let duration = 0;
    try {
      duration = await getVideoDuration(req.file.path);
      console.log('Video duration:', duration);
    } catch (durationError) {
      console.warn('Failed to get video duration, continuing with upload:', durationError.message);
    }

    // Upload video to cloudinary
    console.log('Uploading to Cloudinary...');
    
    try {
      const result = await cloudinary.uploader.upload(req.file.path, {
        resource_type: 'video',
        folder: 'streamvibe/videos',
        chunk_size: 6000000, // Use larger chunks (6MB)
        eager: [
          { format: 'mp4', quality: 'auto' },
          { format: 'webm', quality: 'auto' }
        ],
        eager_async: true,
        timeout: 120000 // Increase timeout to 2 minutes
      });
      
      console.log('Cloudinary upload result:', {
        url: result.secure_url,
        public_id: result.public_id,
        format: result.format,
        resource_type: result.resource_type
      });

      // Delete local file
      fs.unlinkSync(req.file.path);
      console.log('Local file deleted');

      res.status(200).json({
        success: true,
        data: {
          videoUrl: result.secure_url,
          duration,
          formats: result.eager && result.eager.length > 0 
            ? result.eager.map(format => ({
                url: format.secure_url,
                format: format.format
              }))
            : [{ url: result.secure_url, format: result.format }]
        }
      });
    } catch (cloudinaryError) {
      console.error('Cloudinary upload error:', cloudinaryError);
      
      // Clean up local file
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error('Error deleting local file:', unlinkError);
        }
      }
      
      throw new Error(`Cloudinary upload failed: ${cloudinaryError.message}`);
    }
  } catch (error) {
    console.error('Video upload error:', error);
    
    // Clean up local file if it exists
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting local file:', unlinkError);
      }
    }

    res.status(400).json({
      success: false,
      error: error.message || 'Failed to upload video'
    });
  }
};

// @desc    Create video
// @route   POST /api/videos
// @access  Private/Teacher
exports.createVideo = async (req, res) => {
  try {
    const {
      title,
      description,
      subject,
      topic,
      tags,
      videoUrl,
      thumbnailUrl,
      duration,
      formats,
      branch,
      year,
      specialAccess // should be array of student IDs
    } = req.body;

    // Check if video with this URL already exists
    const existingVideo = await Video.findOne({ videoUrl });
    if (existingVideo) {
      return res.status(400).json({
        success: false,
        error: 'A video with this URL already exists'
      });
    }

    const video = await Video.create({
      title,
      description,
      subject,
      topic,
      tags,
      videoUrl,
      thumbnailUrl,
      duration,
      formats,
      branch,
      year,
      specialAccess: Array.isArray(specialAccess) ? specialAccess : [],
      teacher: req.user._id
    });

    res.status(201).json({
      success: true,
      data: video
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get all videos
// @route   GET /api/videos
// @access  Public/Private
exports.getVideos = async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};

    // If search term is provided, search in title, description, topic, and tags
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { topic: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // If user is authenticated, apply user-specific filters
    if (req.user) {
      console.log('User info:', {
        role: req.user.role,
        branch: req.user.branch,
        year: req.user.year,
        id: req.user._id
      });

      // If user is a student, only show videos for their branch and year
      if (req.user.role === 'student') {
        const studentQuery = {
          $and: [
            query, // Include any search query
            {
              $or: [
                // Show videos matching student's branch and year
                {
                  branch: req.user.branch,
                  year: req.user.year
                },
                // Show videos with special access for this student
                {
                  specialAccess: { $in: [req.user._id] }
                }
              ]
            }
          ]
        };
        query = studentQuery;
      }
      // If user is a teacher, show their own videos
      else if (req.user.role === 'teacher') {
        if (Object.keys(query).length > 0) {
          query = {
            $and: [
              query,
              { teacher: req.user._id }
            ]
          };
        } else {
          query = { teacher: req.user._id };
        }
      }
    } else {
      console.log('Public access to videos - no user info available');
      // For public access, only show a limited set of videos or apply other restrictions
      // This could be modified based on your requirements
    }

    console.log('Query:', JSON.stringify(query));

    const videos = await Video.find(query)
      .populate('teacher', 'name email')
      .populate({
        path: 'likes',
        select: '_id'
      })
      .populate({
        path: 'comments',
        select: '_id'
      })
      .sort('-createdAt');

    console.log(`Found ${videos.length} videos`);

    res.status(200).json({
      success: true,
      count: videos.length,
      data: videos
    });
  } catch (error) {
    console.error('Error in getVideos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get single video
// @route   GET /api/videos/:id
// @access  Public/Private
exports.getVideo = async (req, res) => {
  try {
    console.log('Fetching video with ID:', req.params.id);
    
    const video = await Video.findById(req.params.id)
      .populate('teacher', 'name email profilePicture')
      .populate({
        path: 'comments',
        populate: {
          path: 'user',
          select: 'name profilePicture'
        }
      });
      
    // Get the likes count
    const likesCount = await Like.countDocuments({ video: req.params.id });

    if (!video) {
      console.log('Video not found with ID:', req.params.id);
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }

    // Log the full video URL to ensure it's correctly retrieved
    console.log('Full video URL from database:', video.videoUrl);
    
    // Check access permissions if user is authenticated
    if (req.user) {
      console.log('Video access check (detailed):', {
        userRole: req.user.role,
        userBranch: req.user.branch,
        userYear: req.user.year,
        videoBranch: video.branch,
        videoYear: video.year,
        videoSpecialAccess: video.specialAccess,
        branchMatch: video.branch === req.user.branch,
        yearMatch: video.year === req.user.year
      });

      // Check if user has access to this video
      if (req.user.role === 'student') {
        // Check branch and year as strings to ensure proper comparison
        const branchMatch = String(video.branch) === String(req.user.branch);
        const yearMatch = String(video.year) === String(req.user.year);
        
        // Check if student has special access
        const hasSpecialAccess = Array.isArray(video.specialAccess) && 
          video.specialAccess.some(id => id.toString() === req.user._id.toString());
        
        const hasAccess = (branchMatch && yearMatch) || hasSpecialAccess;

        console.log('Student access calculation:', {
          branchMatch,
          yearMatch,
          specialAccess: video.specialAccess,
          hasSpecialAccess,
          hasAccess,
          videoBranch: video.branch,
          videoYear: video.year,
          studentBranch: req.user.branch,
          studentYear: req.user.year
        });

        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            error: 'You do not have access to this video'
          });
        }
      }
      
      // Check if user has liked the video
      const userLiked = await Like.findOne({ video: req.params.id, user: req.user._id });
    } else {
      console.log('Public access to video - no user info available');
    }

    // Create optimized video URL if it's a Cloudinary URL
    const videoData = video.toObject();
    
    // Add likes count to the response
    videoData.likes = likesCount;
    
    // Check if the current user has liked this video
    if (req.user) {
      const userLiked = await Like.findOne({ video: req.params.id, user: req.user._id });
      videoData.isLiked = !!userLiked;
    }
    
    if (videoData.videoUrl && videoData.videoUrl.includes('cloudinary.com')) {
      try {
        // Example URL: https://res.cloudinary.com/cloud-name/video/upload/v1234567890/folder/filename.mp4
        const urlParts = videoData.videoUrl.split('/upload/');
        if (urlParts.length === 2) {
          // Use more compatible transformations without streaming profile
          // f_auto = automatic format
          // q_auto = automatic quality
          videoData.optimizedVideoUrl = `${urlParts[0]}/upload/q_auto/f_auto/${urlParts[1]}`;
          console.log('Created optimized video URL:', videoData.optimizedVideoUrl);
        }
      } catch (err) {
        console.error('Error creating optimized Cloudinary URL:', err);
        // Continue with original URL
      }
    }

    console.log('Sending video data with URLs:', {
      originalUrl: videoData.videoUrl,
      optimizedUrl: videoData.optimizedVideoUrl || 'none',
      likesCount: videoData.likes,
      commentsCount: videoData.comments ? videoData.comments.length : 0
    });

    res.status(200).json({
      success: true,
      data: videoData
    });
  } catch (error) {
    console.error('Error in getVideo:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Update video
// @route   PUT /api/videos/:id
// @access  Private/Teacher
exports.updateVideo = async (req, res) => {
  try {
    const {
      title,
      description,
      subject,
      tags,
      thumbnailUrl,
      branch,
      year,
      specialAccess
    } = req.body;

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
        error: 'Not authorized to update this video'
      });
    }

    // Handle thumbnail upload
    let thumbnail = video.thumbnailUrl;
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'streamvibe/thumbnails',
        resource_type: 'image'
      });
      thumbnail = result.secure_url;
      fs.unlinkSync(req.file.path);

      // Delete old thumbnail if exists
      if (video.thumbnailUrl) {
        const publicId = video.thumbnailUrl.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`streamvibe/thumbnails/${publicId}`);
      }
    }

    const updatedVideo = await Video.findByIdAndUpdate(
      req.params.id,
      {
        title,
        description,
        subject,
        tags,
        thumbnailUrl: thumbnail,
        branch,
        year,
        specialAccess,
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: updatedVideo
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Delete video
// @route   DELETE /api/videos/:id
// @access  Private/Teacher
exports.deleteVideo = async (req, res) => {
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
        error: 'Not authorized to delete this video'
      });
    }

    // Delete video from cloudinary
    const videoPublicId = video.videoUrl.split('/').pop().split('.')[0];
    await cloudinary.uploader.destroy(`streamvibe/videos/${videoPublicId}`, { resource_type: 'video' });

    // Delete thumbnail if exists
    if (video.thumbnailUrl) {
      const thumbnailPublicId = video.thumbnailUrl.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(`streamvibe/thumbnails/${thumbnailPublicId}`);
    }

    await video.remove();

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

// Helper function to get video duration
const getVideoDuration = (filePath) => {
  return new Promise((resolve, reject) => {
    try {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          console.warn('Could not get video duration:', err.message);
          // Return a default duration if ffprobe fails
          resolve(0);
        } else {
          resolve(Math.round(metadata.format.duration));
        }
      });
    } catch (error) {
      console.warn('Error using ffprobe:', error.message);
      // Return a default duration if ffprobe fails
      resolve(0);
    }
  });
};

// @desc    Like video
// @route   PUT /api/videos/:id/like
// @access  Private
exports.likeVideo = async (req, res) => {
  try {
    // Find the video
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }
    
    // Check if the user has already liked the video
    let liked = false;
    let existingLike = null;
    
    try {
      existingLike = await Like.findOne({
        video: req.params.id,
        user: req.user._id
      });
    } catch (err) {
      console.error('Error checking for existing like:', err);
      // Continue with the function
    }
    
    // Handle like/unlike
    if (existingLike) {
      // Unlike the video
      try {
        await Like.findByIdAndDelete(existingLike._id);
        liked = false;
      } catch (err) {
        console.error('Error unliking video:', err);
        return res.status(500).json({
          success: false,
          error: 'Failed to unlike video'
        });
      }
    } else {
      // Like the video
      try {
        await Like.create({
          video: req.params.id,
          user: req.user._id
        });
        liked = true;
      } catch (err) {
        console.error('Error liking video:', err);
        return res.status(500).json({
          success: false,
          error: 'Failed to like video'
        });
      }
      
      // Create notification for video owner
      try {
        if (video.teacher && video.teacher.toString() !== req.user._id.toString()) {
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
      } catch (err) {
        console.error('Error creating notification:', err);
        // Continue with the function, notification is not critical
      }
    }
    
    return res.status(200).json({
      success: true,
      data: { liked }
    });
  } catch (error) {
    console.error('Error handling like/unlike:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Get video analytics
// @route   GET /api/videos/:id/analytics
// @access  Private/Teacher
exports.getVideoAnalytics = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }
    
    // Check if user is the video owner or admin
    if (req.user.role !== 'admin' && video.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view analytics'
      });
    }
    
    // Get view statistics
    const views = await VideoView.find({ video: video._id })
      .populate('student', 'name branch year');
    
    // Get likes
    const likes = await Like.find({ video: video._id })
      .populate('student', 'name branch year');
    
    // Get comments
    const comments = await Comment.find({ video: video._id })
      .populate('student', 'name branch year');
    
    // Calculate watch time statistics
    const watchTimeStats = await VideoView.aggregate([
      { $match: { video: video._id } },
      { $group: {
        _id: null,
        totalWatchTime: { $sum: '$watchTime' },
        avgWatchTime: { $avg: '$watchTime' },
        maxWatchTime: { $max: '$watchTime' },
        minWatchTime: { $min: '$watchTime' }
      }}
    ]);
    
    // Calculate views by branch and year
    const viewsByBranch = await VideoView.aggregate([
      { $match: { video: video._id } },
      { $lookup: {
        from: 'users',
        localField: 'student',
        foreignField: '_id',
        as: 'studentInfo'
      }},
      { $unwind: '$studentInfo' },
      { $group: {
        _id: '$studentInfo.branch',
        count: { $sum: 1 }
      }}
    ]);
    
    const viewsByYear = await VideoView.aggregate([
      { $match: { video: video._id } },
      { $lookup: {
        from: 'users',
        localField: 'student',
        foreignField: '_id',
        as: 'studentInfo'
      }},
      { $unwind: '$studentInfo' },
      { $group: {
        _id: '$studentInfo.year',
        count: { $sum: 1 }
      }}
    ]);
    
    // Get daily view counts for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const dailyViews = await VideoView.aggregate([
      { $match: { 
        video: video._id,
        createdAt: { $gte: thirtyDaysAgo }
      }},
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        video: {
          title: video.title,
          views: video.views,
          likes: video.likes
        },
        watchTime: watchTimeStats[0] || {
          totalWatchTime: 0,
          avgWatchTime: 0,
          maxWatchTime: 0,
          minWatchTime: 0
        },
        viewsByBranch,
        viewsByYear,
        dailyViews,
        engagement: {
          totalViews: views.length,
          totalLikes: likes.length,
          totalComments: comments.length,
          uniqueViewers: new Set(views.map(v => v.student._id.toString())).size
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

// @desc    Update special access for a video
// @route   PUT /api/videos/:id/access
// @access  Private/Admin
exports.updateSpecialAccess = async (req, res) => {
  try {
    const { studentIds } = req.body;
    
    if (!studentIds || !Array.isArray(studentIds)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an array of student IDs'
      });
    }
    
    let video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }
    
    // Update the special access list
    video.specialAccess = studentIds;
    await video.save();
    
    // Create notifications for all affected students
    const notificationPromises = studentIds.map(studentId => {
      return Notification.create({
        recipient: studentId,
        type: 'video',
        relatedId: video._id,
        content: `You have been granted special access to the video "${video.title}"`
      });
    });
    
    await Promise.all(notificationPromises);
    
    res.status(200).json({
      success: true,
      data: video
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Bulk update videos
// @route   PUT /api/videos/bulk
// @access  Private/Teacher
exports.bulkUpdateVideos = async (req, res) => {
  try {
    const { videoIds, updates } = req.body;
    
    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide video IDs to update'
      });
    }
    
    // Check if user is the owner of all videos
    const videos = await Video.find({
      _id: { $in: videoIds },
      teacher: req.user._id
    });
    
    if (videos.length !== videoIds.length) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update some videos'
      });
    }
    
    // Update all videos
    const result = await Video.updateMany(
      { _id: { $in: videoIds } },
      { $set: updates }
    );
    
    res.status(200).json({
      success: true,
      data: {
        modifiedCount: result.modifiedCount,
        message: `Successfully updated ${result.modifiedCount} videos`
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Bulk delete videos
// @route   DELETE /api/videos/bulk
// @access  Private/Teacher
exports.bulkDeleteVideos = async (req, res) => {
  try {
    const { videoIds } = req.body;
    
    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide video IDs to delete'
      });
    }
    
    // Check if user is the owner of all videos
    const videos = await Video.find({
      _id: { $in: videoIds },
      teacher: req.user._id
    });
    
    if (videos.length !== videoIds.length) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete some videos'
      });
    }
    
    // Delete videos from Cloudinary
    for (const video of videos) {
      await cloudinary.uploader.destroy(video.publicId, { resource_type: 'video' });
    }
    
    // Delete videos from database
    const result = await Video.deleteMany({ _id: { $in: videoIds } });
    
    res.status(200).json({
      success: true,
      data: {
        deletedCount: result.deletedCount,
        message: `Successfully deleted ${result.deletedCount} videos`
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Unlike video
// @route   PUT /api/videos/:id/unlike
// @access  Private
exports.unlikeVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }
    
    // Check if video is liked
    if (!video.likes.includes(req.user.id)) {
      return res.status(400).json({
        success: false,
        error: 'Video not liked yet'
      });
    }
    
    video.likes = video.likes.filter(
      like => like.toString() !== req.user.id
    );
    
    await video.save();
    
    res.status(200).json({
      success: true,
      data: video
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Add comment
// @route   POST /api/videos/:id/comments
// @access  Private
exports.addComment = async (req, res) => {
  try {
    const { text } = req.body;
    
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }
    
    const comment = {
      text,
      user: req.user.id
    };
    
    video.comments.unshift(comment);
    await video.save();
    
    res.status(200).json({
      success: true,
      data: video
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Remove comment
// @route   DELETE /api/videos/:id/comments/:commentId
// @access  Private
exports.removeComment = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }
    
    // Get comment
    const comment = video.comments.find(
      comment => comment._id.toString() === req.params.commentId
    );
    
    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found'
      });
    }
    
    // Check if user is comment owner
    if (comment.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this comment'
      });
    }
    
    // Remove comment
    video.comments = video.comments.filter(
      comment => comment._id.toString() !== req.params.commentId
    );
    
    await video.save();
    
    res.status(200).json({
      success: true,
      data: video
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get video comments
// @route   GET /api/videos/:id/comments
// @access  Public
exports.getVideoComments = async (req, res) => {
  try {
    // Find comments directly using the Comment model instead of accessing through Video model
    const comments = await Comment.find({ video: req.params.id })
      .populate('user', 'name profilePicture')
      .sort('-createdAt');
    
    res.status(200).json({
      success: true,
      count: comments.length,
      data: comments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Proxy video stream to handle CORS issues
// @route   GET /api/videos/proxy/:id
// @access  Public
exports.proxyVideo = async (req, res) => {
  try {
    console.log('⭐ VIDEO PROXY REQUEST received for ID:', req.params.id);
    
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      console.error('❌ Video not found with ID:', req.params.id);
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }
    
    // If video URL is not available
    if (!video.videoUrl) {
      console.error('❌ Video URL not found for ID:', req.params.id);
      return res.status(404).json({
        success: false,
        error: 'Video URL not found'
      });
    }
    
    // Log the video URL
    console.log('📽️ Proxying video URL:', video.videoUrl);
    
    // Create optimized video URL if it's a Cloudinary URL
    let videoUrl = video.videoUrl;
    
    if (videoUrl && videoUrl.includes('cloudinary.com')) {
      try {
        // Example URL: https://res.cloudinary.com/cloud-name/video/upload/v1234567890/folder/filename.mp4
        const urlParts = videoUrl.split('/upload/');
        if (urlParts.length === 2) {
          // Use more compatible transformations without streaming profile
          // f_auto = automatic format
          // q_auto = automatic quality
          // Replace sp_hd/vc_auto/q_auto with q_auto/f_auto
          videoUrl = `${urlParts[0]}/upload/q_auto/f_auto/${urlParts[1]}`;
          console.log('✅ Using optimized Cloudinary URL:', videoUrl);
        }
      } catch (err) {
        console.error('⚠️ Error creating optimized Cloudinary URL:', err.message);
        // Continue with original URL
      }
    }
    
    // Get range header for streaming support
    const range = req.headers.range;
    console.log('📊 Range header:', range || 'none');
    
    // Use axios to stream the video
    const axios = require('axios');
    
    try {
      // Add range header if present and other headers to help with CORS
      const headers = {
        'Origin': req.headers.origin || 'http://localhost:5173',
        'Referer': req.headers.referer || 'http://localhost:5173',
        'User-Agent': req.headers['user-agent'] || 'StreamVibe/1.0'
      };
      
      if (range) {
        headers.Range = range;
      }
      
      console.log('📤 Request headers:', headers);
      
      const videoResponse = await axios({
        method: 'get',
        url: videoUrl,
        headers,
        responseType: 'stream',
        maxRedirects: 5,
        timeout: 30000 // 30 seconds timeout
      });
      
      console.log('📥 Response status:', videoResponse.status);
      console.log('📥 Response headers:', videoResponse.headers);
      
      // Set appropriate CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Origin, Referer');
      
      // Set content type and other headers from the response
      if (videoResponse.headers['content-type']) {
        res.setHeader('Content-Type', videoResponse.headers['content-type']);
        console.log('📋 Setting content-type:', videoResponse.headers['content-type']);
      } else {
        res.setHeader('Content-Type', 'video/mp4');
        console.log('📋 Setting default content-type: video/mp4');
      }
      
      if (videoResponse.headers['content-length']) {
        res.setHeader('Content-Length', videoResponse.headers['content-length']);
        console.log('📋 Setting content-length:', videoResponse.headers['content-length']);
      }
      
      res.setHeader('Accept-Ranges', 'bytes');
      
      // Copy other important headers
      if (videoResponse.headers['content-range']) {
        res.setHeader('Content-Range', videoResponse.headers['content-range']);
        console.log('📋 Setting content-range:', videoResponse.headers['content-range']);
      }
      
      // Set cache headers for better performance
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      
      // Set status code based on response
      res.status(videoResponse.status);
      console.log('📈 Setting response status:', videoResponse.status);
      
      // Stream the video
      console.log('🚀 Starting to stream video to client');
      videoResponse.data.pipe(res);
      
      // Handle errors during streaming
      videoResponse.data.on('error', (err) => {
        console.error('❌ Stream error during proxy:', err.message);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Error streaming video'
          });
        }
      });
      
      // Log completion of streaming
      videoResponse.data.on('end', () => {
        console.log('✅ Video stream completed successfully');
      });
      
    } catch (axiosError) {
      console.error('❌ Error proxying video with axios:', axiosError.message);
      
      if (axiosError.response) {
        console.error('  Status:', axiosError.response.status);
        console.error('  Headers:', axiosError.response.headers);
      }
      
      // Check if headers have already been sent
      if (res.headersSent) {
        console.error('  Headers already sent, cannot send error response');
        return;
      }
      
      // Fallback to direct redirect if streaming fails
      console.log('⚠️ Falling back to redirect for video URL');
      res.redirect(videoUrl);
    }
  } catch (error) {
    console.error('❌ Error proxying video:', error.message);
    console.error('  Stack:', error.stack);
    
    // Check if headers have already been sent
    if (res.headersSent) {
      console.error('  Headers already sent, cannot send error response');
      return;
    }
    
    res.status(500).json({
      success: false,
      error: 'Error streaming video'
    });
  }
};

// @desc    Upload thumbnail
// @route   POST /api/videos/thumbnail
// @access  Private/Teacher
exports.uploadThumbnail = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Please upload an image file'
      });
    }

    console.log('Thumbnail file received:', {
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    });

    // Upload thumbnail to cloudinary
    console.log('Uploading thumbnail to Cloudinary...');
    
    try {
      const result = await cloudinary.uploader.upload(req.file.path, {
        resource_type: 'image',
        folder: 'streamvibe/thumbnails',
        transformation: [
          { width: 1280, height: 720, crop: 'fill' },
          { quality: 'auto' }
        ]
      });
      
      console.log('Cloudinary thumbnail upload result:', {
        url: result.secure_url,
        public_id: result.public_id
      });

      // Delete local file
      fs.unlinkSync(req.file.path);
      console.log('Local thumbnail file deleted');

      res.status(200).json({
        success: true,
        data: {
          thumbnailUrl: result.secure_url,
          publicId: result.public_id
        }
      });
    } catch (cloudinaryError) {
      console.error('Cloudinary thumbnail upload error:', cloudinaryError);
      
      // Clean up local file
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error('Error deleting local thumbnail file:', unlinkError);
        }
      }
      
      throw new Error(`Cloudinary thumbnail upload failed: ${cloudinaryError.message}`);
    }
  } catch (error) {
    console.error('Thumbnail upload error:', error);
    
    // Clean up local file if it exists
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting local thumbnail file:', unlinkError);
      }
    }

    res.status(400).json({
      success: false,
      error: error.message || 'Failed to upload thumbnail'
    });
  }
};

// @desc    Get watch history for current user
// @route   GET /api/videos/history
// @access  Private
exports.getWatchHistory = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: 'watchHistory',
      select: 'title thumbnailUrl views createdAt teacher',
      populate: {
        path: 'teacher',
        select: 'name profilePicture'
      }
    });

    const history = user.watchHistory || [];
    
    // Apply limit if provided in query
    const limit = parseInt(req.query.limit, 10) || 0;
    const limitedHistory = limit > 0 ? history.slice(0, limit) : history;

    res.status(200).json({
      success: true,
      count: limitedHistory.length,
      data: limitedHistory
    });
  } catch (error) {
    console.error('Error fetching watch history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get all unique video subjects
// @route   GET /api/videos/subjects
// @access  Public
exports.getVideoSubjects = async (req, res) => {
  try {
    const subjects = await Video.distinct('subject');
    
    res.status(200).json({
      success: true,
      count: subjects.length,
      data: subjects
    });
  } catch (error) {
    console.error('Error fetching video subjects:', error);
    res.status(500).json({
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
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }

    // Get all likes for this video
    const likes = await Like.find({ video: req.params.id })
      .populate('user', 'name email profilePicture role');

    // Check if current user has liked the video
    const userLiked = req.user ? await Like.findOne({ video: req.params.id, user: req.user._id }) : null;

    res.status(200).json({
      success: true,
      count: likes.length,
      userLiked: !!userLiked,
      data: likes
    });
  } catch (error) {
    console.error('Error getting video likes:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
};
