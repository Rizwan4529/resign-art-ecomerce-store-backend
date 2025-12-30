// =============================================================================
// REPORT ROUTES - Profit & Expense Management Routes
// =============================================================================
// 
// Routes for reports (Sections 5.13 & 5.14)
// Base path: /api/reports
//
// =============================================================================

const express = require('express');
const router = express.Router();

const {
  getProfitSummary,
  generateProfitReport,
  addExpense,
  getExpenses,
  getExpensesByCategory,
  getTotalExpenses,
  setBudget,
  getBudgets,
  getDashboardSummary,
} = require('../controllers/reportController');

const { protect, authorize } = require('../middleware/authMiddleware');

// All routes require admin authentication
router.use(protect);
router.use(authorize('ADMIN'));

// =============================================================================
// DASHBOARD
// =============================================================================

// @route   GET /api/reports/dashboard
// @desc    Get dashboard summary
// @access  Private/Admin
router.get('/dashboard', getDashboardSummary);

// =============================================================================
// PROFIT ROUTES
// =============================================================================

// @route   GET /api/reports/profit
// @desc    Get profit summary
// @access  Private/Admin
router.get('/profit', getProfitSummary);

// @route   GET /api/reports/profit/detailed
// @desc    Generate detailed profit report
// @access  Private/Admin
router.get('/profit/detailed', generateProfitReport);

// =============================================================================
// EXPENSE ROUTES
// =============================================================================

// @route   GET /api/reports/expenses
// @desc    Get all expenses
// @access  Private/Admin
router.get('/expenses', getExpenses);

// @route   GET /api/reports/expenses/by-category
// @desc    Get expenses by category
// @access  Private/Admin
router.get('/expenses/by-category', getExpensesByCategory);

// @route   GET /api/reports/expenses/total
// @desc    Get total expenses
// @access  Private/Admin
router.get('/expenses/total', getTotalExpenses);

// @route   POST /api/reports/expenses
// @desc    Add an expense
// @access  Private/Admin
router.post('/expenses', addExpense);

// =============================================================================
// BUDGET ROUTES
// =============================================================================

// @route   GET /api/reports/budgets
// @desc    Get budgets
// @access  Private/Admin
router.get('/budgets', getBudgets);

// @route   POST /api/reports/budgets
// @desc    Set budget limit
// @access  Private/Admin
router.post('/budgets', setBudget);

module.exports = router;
