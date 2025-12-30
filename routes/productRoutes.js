// =============================================================================
// PRODUCT ROUTES - Product Management Routes
// =============================================================================
// 
// Routes for product management (Section 5.2)
// Base path: /api/products
//
// =============================================================================

const express = require('express');
const router = express.Router();

const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getFeaturedProducts,
  getProductsByCategory,
  searchProducts,
} = require('../controllers/productController');

const { protect, authorize, optionalAuth } = require('../middleware/authMiddleware');
const { uploadMultiple } = require('../middleware/uploadMiddleware');

// =============================================================================
// PUBLIC ROUTES
// =============================================================================

// @route   GET /api/products/featured
// @desc    Get featured products
// @access  Public
router.get('/featured', getFeaturedProducts);

// @route   GET /api/products/search
// @desc    Search products
// @access  Public
router.get('/search', searchProducts);

// @route   GET /api/products/category/:category
// @desc    Get products by category
// @access  Public
router.get('/category/:category', getProductsByCategory);

// @route   GET /api/products
// @desc    Get all products (with filters)
// @access  Public
router.get('/', optionalAuth, getProducts);

// @route   GET /api/products/:id
// @desc    Get single product
// @access  Public
router.get('/:id', optionalAuth, getProduct);

// =============================================================================
// ADMIN ROUTES
// =============================================================================

// @route   POST /api/products
// @desc    Create a product
// @access  Private/Admin
router.post('/', protect, authorize('ADMIN'), uploadMultiple, createProduct);

// @route   PUT /api/products/:id
// @desc    Update a product
// @access  Private/Admin
router.put('/:id', protect, authorize('ADMIN'), uploadMultiple, updateProduct);

// @route   DELETE /api/products/:id
// @desc    Delete a product
// @access  Private/Admin
router.delete('/:id', protect, authorize('ADMIN'), deleteProduct);

module.exports = router;
