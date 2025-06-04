const Notice = require('../models/Notice');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { cloudinary } = require('../config/cloudinary');
const fs = require('fs');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const multer = require('multer');
const path = require('path');

// Configure multer for PDF uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new ErrorResponse('Only PDF files are allowed', 400), false);
    }
  }
});

// @desc    Create a notice
// @route   POST /api/notices
// @access  Private/Teacher
exports.createNotice = async (req, res) => {
  try {
    const {
      title,
      content,
      category,
      branch,
      year,
      priority,
      expirationType,
      expirationDate,
      expirationDuration
    } = req.body;

    // Validate required fields
    if (!title || !content || !category || !branch || !year || !priority || !expirationType) {
      return res.status(400).json({ error: 'Please provide all required fields' });
    }

    // Validate branch and year
    if (branch === 'All' || year === 'All') {
      return res.status(400).json({ error: 'Please select specific branch and year' });
    }

    // Create notice with expiration data
    const notice = await Notice.create({
      title,
      content,
      category,
      branch,
      year,
      priority,
      expiration: {
        type: expirationType,
        ...(expirationType === 'date' ? { date: expirationDate } : { duration: expirationDuration })
      },
      teacher: req.user.id
    });

    // Handle file uploads if any
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(file => {
        return new Promise((resolve, reject) => {
          cloudinary.uploader.upload(file.path, {
            resource_type: 'auto',
            folder: 'notices'
          }, (error, result) => {
            if (error) reject(error);
            else resolve(result);
          });
        });
      });

      const uploadResults = await Promise.all(uploadPromises);
      notice.attachments = uploadResults.map(result => ({
        filename: result.original_filename,
        originalname: result.original_filename,
        url: result.secure_url,
        size: result.bytes,
        mimetype: 'application/pdf'
      }));
      await notice.save();
    }

    res.status(201).json({
      success: true,
      data: notice
    });
  } catch (error) {
    console.error('Error creating notice:', error);
    res.status(500).json({ error: error.message });
  }
};

// @desc    Get all notices
// @route   GET /api/notices
// @access  Public
exports.getNotices = asyncHandler(async (req, res, next) => {
  const { branch, year, category, priority } = req.query;
  
  // Build query
  let query = { isActive: true };
  
  // Filter by branch if specified and not 'All'
  if (branch && branch !== 'All') {
    query.branch = branch;
  }
  
  // Filter by year if specified and not 'All'
  if (year && year !== 'All') {
    query.year = year;
  }
  
  // Filter by category if specified
  if (category) {
    query.category = category;
  }
  
  // Filter by priority if specified
  if (priority) {
    query.priority = priority;
  }
  
  // Get notices and populate teacher info
  const notices = await Notice.find(query)
    .populate('teacher', 'name email')
    .sort('-createdAt');
  
  // Filter out expired notices
  const activeNotices = notices.filter(notice => !notice.isExpired());
  
  res.status(200).json({
    success: true,
    count: activeNotices.length,
    data: activeNotices
  });
});

// @desc    Get single notice
// @route   GET /api/notices/:id
// @access  Public
exports.getNotice = asyncHandler(async (req, res, next) => {
  const notice = await Notice.findById(req.params.id)
    .populate('teacher', 'name email');
    
  if (!notice) {
    return next(new ErrorResponse(`Notice not found with id of ${req.params.id}`, 404));
  }
  
  // Check if notice is expired
  if (notice.isExpired()) {
    return next(new ErrorResponse('This notice has expired', 400));
  }
  
  res.status(200).json({
    success: true,
    data: notice
  });
});

// @desc    Update a notice
// @route   PUT /api/notices/:id
// @access  Private/Teacher
exports.updateNotice = asyncHandler(async (req, res, next) => {
  let notice = await Notice.findById(req.params.id);
  
  if (!notice) {
    return next(new ErrorResponse(`Notice not found with id of ${req.params.id}`, 404));
  }
  
  // Make sure user is notice owner or admin
  if (notice.teacher.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse(`User ${req.user.id} is not authorized to update this notice`, 401));
  }
  
  // Handle file uploads if any
  if (req.files && req.files.length > 0) {
    const uploadPromises = req.files.map(async (file) => {
      const result = await cloudinary.uploader.upload(file.path, {
        resource_type: 'raw',
        folder: 'notices',
        format: 'pdf'
      });
      
      return {
        filename: result.public_id,
        originalname: file.originalname,
        url: result.secure_url,
        size: file.size,
        mimetype: file.mimetype
      };
    });
    
    req.body.attachments = await Promise.all(uploadPromises);
  }
  
  notice = await Notice.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  
  res.status(200).json({
    success: true,
    data: notice
  });
});

// Helper function to create notifications for a notice
const createNotifications = async (notice) => {
  try {
    // Find all students who should receive this notice
    const query = { role: 'student' };

    if (notice.targetAudience) {
      const { branches, years } = notice.targetAudience;
      
      if (branches && !branches.includes('All')) {
        query.branch = { $in: branches };
      }
      
      if (years && !years.includes('All')) {
        query.year = { $in: years };
      }
    }

    const students = await User.find(query);

    // Create notifications for each student
    const notifications = students.map(student => ({
      recipient: student._id,
      type: 'notice_posted',
      title: 'New Notice',
      message: notice.title,
      data: {
        noticeId: notice._id,
        category: notice.category,
        priority: notice.priority
      }
    }));

    await Notification.insertMany(notifications);
  } catch (error) {
    console.error('Error creating notifications:', error);
  }
};

// @desc    Delete a notice
// @route   DELETE /api/notices/:id
// @access  Private/Teacher
exports.deleteNotice = asyncHandler(async (req, res, next) => {
  const notice = await Notice.findById(req.params.id);
  
  if (!notice) {
    return next(new ErrorResponse(`Notice not found with id of ${req.params.id}`, 404));
  }
  
  // Make sure user is notice owner or admin
  if (notice.teacher.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse(`User ${req.user.id} is not authorized to delete this notice`, 401));
  }
  
  // Delete attachments from cloudinary if any
  if (notice.attachments && notice.attachments.length > 0) {
    const deletePromises = notice.attachments.map(attachment => 
      cloudinary.uploader.destroy(attachment.filename)
    );
    await Promise.all(deletePromises);
  }
  
  await notice.remove();
  
  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Get notice statistics
// @route   GET /api/notices/stats
// @access  Private/Teacher
exports.getNoticeStats = async (req, res) => {
  try {
    const stats = await Notice.aggregate([
      { $match: { author: req.user._id } },
      { $group: {
        _id: '$category',
        count: { $sum: 1 },
        totalViews: { $sum: '$views' }
      }},
      { $sort: { count: -1 } }
    ]);

    const priorityStats = await Notice.aggregate([
      { $match: { author: req.user._id } },
      { $group: {
        _id: '$priority',
        count: { $sum: 1 }
      }}
    ]);

    const monthlyStats = await Notice.aggregate([
      { $match: { author: req.user._id } },
      { $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        count: { $sum: 1 }
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        categoryStats: stats,
        priorityStats,
        monthlyStats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get teacher's notices
// @route   GET /api/notices/my-notices
// @access  Private/Teacher
exports.getMyNotices = asyncHandler(async (req, res, next) => {
  const { category, priority, status } = req.query;
  
  // Build query
  let query = { teacher: req.user.id };
  
  // Filter by category if specified
  if (category) {
    query.category = category;
  }
  
  // Filter by priority if specified
  if (priority) {
    query.priority = priority;
  }
  
  // Get notices
  const notices = await Notice.find(query)
    .sort('-createdAt');
  
  // Filter by status if specified
  let filteredNotices = notices;
  if (status === 'active') {
    filteredNotices = notices.filter(notice => !notice.isExpired());
  } else if (status === 'expired') {
    filteredNotices = notices.filter(notice => notice.isExpired());
  }
  
  res.status(200).json({
    success: true,
    count: filteredNotices.length,
    data: filteredNotices
  });
});
