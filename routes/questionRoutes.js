const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createQuestion,
  getQuestions,
  getQuestion,
  addAnswer
} = require('../controllers/questionController');

// All routes need authentication
router.use(protect);

// Routes for questions
router.route('/')
  .get(getQuestions)
  .post(createQuestion);

router.route('/:id')
  .get(getQuestion);

router.route('/:id/answers')
  .post(addAnswer);

module.exports = router; 