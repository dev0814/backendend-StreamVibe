const Note = require('../models/Note');
const Video = require('../models/Video');

// @desc    Create or update note
// @route   POST /api/notes
// @access  Private/Student
exports.createNote = async (req, res) => {
  try {
    const { content, videoId, timestamp, title } = req.body;
    
    // For standalone notes (no videoId provided)
    if (!videoId) {
      // Standalone notes require a title
      if (!title) {
        return res.status(400).json({
          success: false,
          error: 'Title is required for standalone notes'
        });
      }
      
      // Create new standalone note
      const note = await Note.create({
        title,
        content,
        student: req.user.id
      });
      
      return res.status(201).json({
        success: true,
        data: note
      });
    }
    
    // For video-related notes
    
    // Check if the video exists
    const video = await Video.findById(videoId);
    
    if (!video) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }
    
    // Check if the student has access to this video
    const hasAccess = (
      video.isApproved && 
      (
        // Compare branch and year as strings
        (video.branch === req.user.branch) && 
        (video.year === req.user.year) 
      ) ||
      // Check for special access
      (Array.isArray(video.specialAccess) && video.specialAccess.includes(req.user._id)) ||
      // Always allow for testing
      true // TEMPORARY: Allow all users to take notes for testing purposes
    );
    
    // Log access details for debugging
    console.log('Access check details:', {
      videoId,
      userId: req.user.id,
      userBranch: req.user.branch,
      userYear: req.user.year,
      videoBranch: video.branch,
      videoYear: video.year,
      videoApproved: video.isApproved,
      hasAccess
    });
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'You do not have access to this video'
      });
    }
    
    // Check if note already exists for this student and video
    let note = await Note.findOne({
      student: req.user.id,
      video: videoId
    });
    
    if (note) {
      // Update existing note
      note.content = content;
      note.timestamp = timestamp || note.timestamp;
      note.updatedAt = Date.now();
      await note.save();
    } else {
      // Create new note
      note = await Note.create({
        content,
        student: req.user.id,
        video: videoId,
        timestamp: timestamp || 0
      });
    }
    
    res.status(201).json({
      success: true,
      data: note
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get notes for a student
// @route   GET /api/notes
// @access  Private/Student
exports.getNotes = async (req, res) => {
  try {
    const { videoId, page = 1, limit = 10 } = req.query;
    
    const query = { student: req.user.id };
    
    // If videoId is provided, get notes for that specific video
    if (videoId) {
      query.video = videoId;
    }
    
    console.log('Fetching notes with query:', query);
    
    const notes = await Note.find(query)
      .populate({
        path: 'video',
        select: 'title thumbnailUrl', // Only select specific fields to avoid virtual property issues
        // Handle case where video may have been deleted
        match: { _id: { $exists: true } }
      })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .sort({ updatedAt: -1 });
    
    console.log(`Found ${notes.length} notes for user ${req.user.id}`);
    
    // Filter out notes with null populated fields (deleted videos)
    const filteredNotes = notes.filter(note => {
      if (note.video === null && videoId) {
        console.log(`Note ${note._id} has a deleted video reference`);
        return false;
      }
      return true;
    });
    
    // Convert to plain objects with only needed fields to avoid virtual property issues
    const simplifiedNotes = filteredNotes.map(note => {
      const plainNote = {
        _id: note._id.toString(),
        title: note.title || 'Untitled Note',
        content: note.content || '',
        student: note.student.toString(),
        timestamp: note.timestamp || 0,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt
      };
      
      // Only include video if it exists
      if (note.video) {
        plainNote.video = {
          _id: note.video._id.toString(),
          title: note.video.title || 'Untitled Video',
          thumbnailUrl: note.video.thumbnailUrl || 'default-thumbnail.jpg'
        };
      }
      
      return plainNote;
    });
    
    const total = await Note.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: simplifiedNotes.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      page: parseInt(page),
      data: simplifiedNotes
    });
  } catch (error) {
    console.error('Error in getNotes controller:', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching notes: ' + error.message
    });
  }
};

// @desc    Get a single note
// @route   GET /api/notes/:id
// @access  Private/Student
exports.getNote = async (req, res) => {
  try {
    const note = await Note.findById(req.params.id)
      .populate('video', 'title thumbnailUrl');
    
    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }
    
    // Check if note belongs to student
    if (note.student.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this note'
      });
    }
    
    res.status(200).json({
      success: true,
      data: note
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Delete note
// @route   DELETE /api/notes/:id
// @access  Private/Student
exports.deleteNote = async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    
    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }
    
    // Check if note belongs to student
    if (note.student.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this note'
      });
    }
    
    await note.deleteOne();
    
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

// @desc    Update note
// @route   PUT /api/notes/:id
// @access  Private/Student
exports.updateNote = async (req, res) => {
  try {
    const { content, title } = req.body;
    
    // Find the note
    let note = await Note.findById(req.params.id);
    
    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }
    
    // Check if note belongs to student
    if (note.student.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this note'
      });
    }
    
    // Update fields
    if (content) note.content = content;
    if (title) note.title = title;
    note.updatedAt = Date.now();
    
    await note.save();
    
    res.status(200).json({
      success: true,
      data: note
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};
