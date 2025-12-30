// =============================================================================
// PAYMENT ROUTES - Payment Management Routes
// =============================================================================
// 
// Routes for payment management (Section 5.6)
// Base path: /api/payments
//
// =============================================================================

const express = require('express');
const router = express.Router();

const {
  processPayment,
  getPaymentByOrder,
  getMyPayments,
  getAllPayments,
  updatePaymentStatus,
} = require('../controllers/paymentController');

const { protect, authorize } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// =============================================================================
// USER ROUTES
// =============================================================================

// @route   POST /api/payments
// @desc    Process a payment
// @access  Private
router.post('/', processPayment);

// @route   GET /api/payments/my-payments
// @desc    Get user's payment history
// @access  Private
router.get('/my-payments', getMyPayments);

// @route   GET /api/payments/order/:orderId
// @desc    Get payment by order ID
// @access  Private
router.get('/order/:orderId', getPaymentByOrder);

// =============================================================================
// ADMIN ROUTES
// =============================================================================

// @route   GET /api/payments
// @desc    Get all payments
// @access  Private/Admin
router.get('/', authorize('ADMIN'), getAllPayments);

// @route   PUT /api/payments/:id/status
// @desc    Update payment status
// @access  Private/Admin
router.put('/:id/status', authorize('ADMIN'), updatePaymentStatus);

module.exports = router;
