// =============================================================================
// STOCK ROUTES - Stock Management Routes
// =============================================================================
// 
// Routes for stock management (Section 5.9)
// Base path: /api/stock
//
// =============================================================================

const express = require('express');
const router = express.Router();

const {
  getStockLevels,
  updateStock,
  getLowStockAlerts,
  bulkUpdateStock,
  getStockReport,
} = require('../controllers/stockController');

const { protect, authorize } = require('../middleware/authMiddleware');

// All routes require admin authentication
router.use(protect);
router.use(authorize('ADMIN'));

// @route   GET /api/stock
// @desc    Get all stock levels
// @access  Private/Admin
router.get('/', getStockLevels);

// @route   GET /api/stock/alerts
// @desc    Get low stock alerts
// @access  Private/Admin
router.get('/alerts', getLowStockAlerts);

// @route   GET /api/stock/report
// @desc    Get stock report
// @access  Private/Admin
router.get('/report', getStockReport);

// @route   PUT /api/stock/bulk
// @desc    Bulk update stock
// @access  Private/Admin
router.put('/bulk', bulkUpdateStock);

// @route   PUT /api/stock/:productId
// @desc    Update stock for a product
// @access  Private/Admin
router.put('/:productId', updateStock);

module.exports = router;
