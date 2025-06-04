const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getAllUsers,
  getSingleUser,
  updateUser,
  deleteUser,
  bulkApproval
} = require('../controllers/userController');

// All routes are protected and admin-only
router.use(protect);
router.use(authorize('admin'));

// User management routes
router.get('/', getAllUsers);
router.put('/approval', bulkApproval);
router.get('/:id', getSingleUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router; 