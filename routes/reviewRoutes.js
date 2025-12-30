// =============================================================================
// REVIEW ROUTES - Review Management Routes
// =============================================================================
// 
// Routes for review management (Section 5.10)
// Base path: /api/reviews
//
// =============================================================================

const express = require('express');
const router = express.Router();

const {
  createReview,
  getProductReviews,
  getMyReviews,
  updateReview,
  deleteReview,
  getAllReviews,
  approveReview,
} = require('../controllers/reviewController');

const { protect, authorize, optionalAuth } = require('../middleware/authMiddleware');

// =============================================================================
// PUBLIC ROUTES
// =============================================================================

// @route   GET /api/reviews/product/:productId
// @desc    Get reviews for a product
// @access  Public
router.get('/product/:productId', getProductReviews);

// =============================================================================
// USER ROUTES
// =============================================================================

// @route   GET /api/reviews/my-reviews
// @desc    Get user's reviews
// @access  Private
router.get('/my-reviews', protect, getMyReviews);

// @route   POST /api/reviews
// @desc    Create a review
// @access  Private
router.post('/', protect, createReview);

// @route   PUT /api/reviews/:id
// @desc    Update a review
// @access  Private
router.put('/:id', protect, updateReview);

// @route   DELETE /api/reviews/:id
// @desc    Delete a review
// @access  Private
router.delete('/:id', protect, deleteReview);

// =============================================================================
// ADMIN ROUTES
// =============================================================================

// @route   GET /api/reviews
// @desc    Get all reviews
// @access  Private/Admin
router.get('/', protect, authorize('ADMIN'), getAllReviews);

// @route   PUT /api/reviews/:id/approve
// @desc    Approve/disapprove a review
// @access  Private/Admin
router.put('/:id/approve', protect, authorize('ADMIN'), approveReview);

module.exports = router;
