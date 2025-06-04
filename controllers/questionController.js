const Question = require('../models/Question');
const Video = require('../models/Video');
const Notification = require('../models/Notification');

// @desc    Create question
// @route   POST /api/questions
// @access  Private
exports.createQuestion = async (req, res) => {
  try {
    const { content, video, timestamp } = req.body;
    
    if (!content || !video) {
      return res.status(400).json({
        success: false,
        error: 'Please provide question content and video ID'
      });
    }
    
    // Verify video exists
    const videoExists = await Video.findById(video);
    if (!videoExists) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }
    
    // Create question
    const question = await Question.create({
      content,
      user: req.user._id,
      video,
      timestamp: timestamp || 0,
      answers: []
    });
    
    // Populate user information before sending response
    const populatedQuestion = await Question.findById(question._id)
      .populate('user', 'name profilePicture')
      .populate('answers.user', 'name profilePicture');
    
    // Create notification for video owner (teacher)
    if (videoExists.teacher && videoExists.teacher.toString() !== req.user._id.toString()) {
      await Notification.create({
        recipient: videoExists.teacher,
        sender: req.user._id,
        type: 'question',
        title: 'New Question',
        message: `${req.user.name} asked a question on your video "${videoExists.title}"`,
        data: {
          videoId: video,
          questionId: question._id
        }
      });
    }
    
    res.status(201).json({
      success: true,
      data: populatedQuestion
    });
  } catch (error) {
    console.error('Error creating question:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get questions for a video
// @route   GET /api/questions?video=:videoId
// @access  Private
exports.getQuestions = async (req, res) => {
  try {
    const { video } = req.query;
    
    if (!video) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a video ID'
      });
    }
    
    // Verify video exists
    const videoExists = await Video.findById(video);
    if (!videoExists) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }
    
    // Get questions for video
    const questions = await Question.find({ video })
      .populate('user', 'name profilePicture')
      .populate('answers.user', 'name profilePicture')
      .sort('-createdAt');
    
    res.status(200).json({
      success: true,
      count: questions.length,
      data: questions
    });
  } catch (error) {
    console.error('Error getting questions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Add answer to question
// @route   POST /api/questions/:id/answers
// @access  Private
exports.addAnswer = async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Please provide answer content'
      });
    }
    
    // Find question
    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({
        success: false,
        error: 'Question not found'
      });
    }
    
    // Create answer
    const answer = {
      content,
      user: req.user._id,
      createdAt: Date.now()
    };
    
    // Add answer to question
    question.answers.push(answer);
    await question.save();
    
    // Populate user info for the new answer
    const updatedQuestion = await Question.findById(question._id)
      .populate('user', 'name profilePicture')
      .populate('answers.user', 'name profilePicture');
    
    const newAnswer = updatedQuestion.answers[updatedQuestion.answers.length - 1];
    
    // Create notification for question owner
    if (question.user.toString() !== req.user._id.toString()) {
      await Notification.create({
        recipient: question.user,
        sender: req.user._id,
        type: 'answer',
        title: 'New Answer',
        message: `${req.user.name} answered your question`,
        data: {
          videoId: question.video,
          questionId: question._id,
          answerId: newAnswer._id
        }
      });
    }
    
    res.status(200).json({
      success: true,
      data: newAnswer
    });
  } catch (error) {
    console.error('Error adding answer:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get a single question with answers
// @route   GET /api/questions/:id
// @access  Private
exports.getQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id)
      .populate('user', 'name profilePicture')
      .populate('answers.user', 'name profilePicture');
    
    if (!question) {
      return res.status(404).json({
        success: false,
        error: 'Question not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: question
    });
  } catch (error) {
    console.error('Error getting question:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}; 