const express = require('express');
const router = express.Router();
const { 
  getAllUsers, 
  getSingleUser, 
  updateUser, 
  deleteUser, 
  bulkApproval
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

// Protect all routes
router.use(protect);

// Admin-only routes
router.route('/')
  .get(authorize('admin'), getAllUsers);

// Put specific routes before the parameter route
router.route('/approval/bulk')
  .put(authorize('admin'), bulkApproval);

router.route('/:id')
  .get(authorize('admin'), getSingleUser)
  .put(authorize('admin'), updateUser)
  .delete(authorize('admin'), deleteUser);

module.exports = router;
