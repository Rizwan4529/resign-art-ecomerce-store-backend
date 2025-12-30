// =============================================================================
// USER ROUTES - User Management Routes
// =============================================================================
// 
// Routes for user management (Section 5.3)
// Base path: /api/users
//
// =============================================================================

const express = require('express');
const router = express.Router();

const {
  getUsers,
  getUser,
  blockUser,
  unblockUser,
  deleteUser,
  updateUserRole,
  getUserStats,
  resetUserPassword,
} = require('../controllers/userController');

const { protect, authorize } = require('../middleware/authMiddleware');

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('ADMIN'));

// @route   GET /api/users/stats
// @desc    Get user statistics
// @access  Private/Admin
router.get('/stats', getUserStats);

// @route   GET /api/users
// @desc    Get all users
// @access  Private/Admin
router.get('/', getUsers);

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private/Admin
router.get('/:id', getUser);

// @route   PUT /api/users/:id/block
// @desc    Block a user
// @access  Private/Admin
router.put('/:id/block', blockUser);

// @route   PUT /api/users/:id/unblock
// @desc    Unblock a user
// @access  Private/Admin
router.put('/:id/unblock', unblockUser);

// @route   PUT /api/users/:id/role
// @desc    Update user role
// @access  Private/Admin
router.put('/:id/role', updateUserRole);

// @route   PUT /api/users/:id/reset-password
// @desc    Reset user password (Admin)
// @access  Private/Admin
router.put('/:id/reset-password', resetUserPassword);

// @route   DELETE /api/users/:id
// @desc    Delete (deactivate) a user
// @access  Private/Admin
router.delete('/:id', deleteUser);

module.exports = router;
