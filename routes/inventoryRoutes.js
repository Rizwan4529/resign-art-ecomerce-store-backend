// =============================================================================
// INVENTORY ROUTES - Inventory Management Endpoints
// =============================================================================
//
// All routes require admin authentication
// Endpoints for viewing inventory, updating stock with history, and alerts
//
// =============================================================================

const express = require('express');
const router = express.Router();
const {
  getInventoryOverview,
  updateInventoryWithHistory,
  getInventoryHistory,
  getInventoryAlerts,
} = require('../controllers/inventoryController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All inventory routes require admin access
// protect: Verifies JWT token and authenticates user
// authorize('ADMIN'): Ensures user has admin role

// =============================================================================
// Inventory Overview and Alerts Routes
// =============================================================================

// @route   GET /api/inventory
// @desc    Get all inventory with stock levels, search, and filters
// @access  Private/Admin
router.get('/', protect, authorize('ADMIN'), getInventoryOverview);

// @route   GET /api/inventory/alerts
// @desc    Get low stock alerts (products with stock <= threshold)
// @access  Private/Admin
router.get('/alerts', protect, authorize('ADMIN'), getInventoryAlerts);

// =============================================================================
// Inventory History Routes
// =============================================================================

// @route   GET /api/inventory/history/:productId
// @desc    Get inventory change history for a specific product
// @access  Private/Admin
router.get('/history/:productId', protect, authorize('ADMIN'), getInventoryHistory);

// =============================================================================
// Inventory Update Routes
// =============================================================================

// @route   PUT /api/inventory/:productId
// @desc    Update stock with history logging (set/add/subtract operations)
// @access  Private/Admin
router.put('/:productId', protect, authorize('ADMIN'), updateInventoryWithHistory);

module.exports = router;
