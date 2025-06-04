const express = require('express');
const router = express.Router();
const { 
  createNote, 
  getNotes, 
  getNote, 
  deleteNote,
  updateNote
} = require('../controllers/noteController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

// Protect all routes
router.use(protect);

// Student only routes
router.use(authorize('student'));

// Create a note and get all notes
router.route('/')
  .post(createNote)
  .get(getNotes);

// Get, update and delete a single note
router.route('/:id')
  .get(getNote)
  .put(updateNote)
  .delete(deleteNote);

module.exports = router;
