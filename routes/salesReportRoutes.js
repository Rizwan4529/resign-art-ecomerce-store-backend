// =============================================================================
// SALES REPORT ROUTES - Sales Reporting Endpoints
// =============================================================================
//
// All routes require admin authentication
// Endpoints for generating sales reports (JSON and PDF formats)
//
// =============================================================================

const express = require('express');
const router = express.Router();
const {
  getSalesReport,
  generateSalesPDF,
} = require('../controllers/salesReportController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All sales report routes require admin access
// protect: Verifies JWT token and authenticates user
// authorize('ADMIN'): Ensures user has admin role

// =============================================================================
// Sales Report Routes
// =============================================================================

// @route   GET /api/reports/sales
// @desc    Get sales report data (JSON format)
// @query   startDate, endDate (YYYY-MM-DD format)
// @access  Private/Admin
router.get('/', protect, authorize('ADMIN'), getSalesReport);

// @route   POST /api/reports/sales/pdf
// @desc    Generate and download sales report as PDF
// @body    startDate, endDate (YYYY-MM-DD format)
// @access  Private/Admin
router.post('/pdf', protect, authorize('ADMIN'), generateSalesPDF);

module.exports = router;
