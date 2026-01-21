// =============================================================================
// ORDER ROUTES - Order Management Routes
// =============================================================================
//
// Routes for order management (Section 5.5)
// Base path: /api/orders
//
// =============================================================================

const express = require("express");
const router = express.Router();

const {
  createOrder,
  getAllOrders,
  getOrder,
  getMyOrders,
  updateOrderStatus,
  updateOrderLocation,
  cancelOrder,
  getOrderTracking,
} = require("../controllers/orderController");

const { protect, authorize } = require("../middleware/authMiddleware");

// All routes require authentication
router.use(protect);

// =============================================================================
// USER ROUTES
// =============================================================================

// @route   GET /api/orders/my-orders
// @desc    Get logged in user's orders
// @access  Private
router.get("/my-orders", getMyOrders);

// @route   POST /api/orders
// @desc    Create a new order
// @access  Private
router.post("/", createOrder);

// @route   GET /api/orders/:id
// @desc    Get order by ID
// @access  Private
router.get("/:id", getOrder);

// @route   GET /api/orders/:id/tracking
// @desc    Get order tracking history
// @access  Private
router.get("/:id/tracking", getOrderTracking);

// @route   PUT /api/orders/:id/cancel
// @desc    Cancel an order
// @access  Private
router.put("/:id/cancel", cancelOrder);

// =============================================================================
// ADMIN ROUTES
// =============================================================================

// @route   GET /api/orders
// @desc    Get all orders (admin)
// @access  Private/Admin
router.get("/", authorize("ADMIN"), getAllOrders);

// @route   PUT /api/orders/:id/status
// @desc    Update order status
// @access  Private/Admin
router.put("/:id/status", authorize("ADMIN"), updateOrderStatus);

// @route   PUT /api/orders/:id/update-location
// @desc    Update order tracking location
// @access  Private/Admin
router.put("/:id/update-location", authorize("ADMIN"), updateOrderLocation);

module.exports = router;
