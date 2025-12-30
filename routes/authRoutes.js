// =============================================================================
// AUTH ROUTES - Security Management Routes
// =============================================================================
// 
// Routes for authentication functionality (Section 5.1)
// Base path: /api/auth
//
// =============================================================================

const express = require('express');
const router = express.Router();

// Import controller functions
const {
  signup,
  login,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  logout,
} = require('../controllers/authController');

// Import middleware
const { protect } = require('../middleware/authMiddleware');

// =============================================================================
// PUBLIC ROUTES - No authentication required
// =============================================================================

// @route   POST /api/auth/signup
// @desc    Register a new user
// @access  Public
router.post('/signup', signup);

// @route   POST /api/auth/login
// @desc    Login user & get token
// @access  Public
router.post('/login', login);

// @route   POST /api/auth/forgot-password
// @desc    Request password reset email
// @access  Public
router.post('/forgot-password', forgotPassword);

// @route   POST /api/auth/reset-password/:token
// @desc    Reset password with token
// @access  Public
router.post('/reset-password/:token', resetPassword);

// =============================================================================
// PROTECTED ROUTES - Authentication required
// =============================================================================

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', protect, getMe);

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', protect, updateProfile);

// @route   PUT /api/auth/change-password
// @desc    Change password (when logged in)
// @access  Private
router.put('/change-password', protect, changePassword);

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', protect, logout);

module.exports = router;
