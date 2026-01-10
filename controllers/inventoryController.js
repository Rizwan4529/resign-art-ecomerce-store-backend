// =============================================================================
// INVENTORY CONTROLLER - Inventory Management with History Tracking
// =============================================================================
//
// Handles inventory operations with complete audit trail:
// - View all inventory with stock levels
// - Update inventory with history logging
// - View inventory change history
// - Get low stock alerts
//
// =============================================================================

const { prisma } = require('../config/db');
const { asyncHandler } = require('../middleware/errorMiddleware');

// =============================================================================
// @desc    Get inventory overview with stock levels
// @route   GET /api/inventory
// @access  Private/Admin
// =============================================================================

const getInventoryOverview = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    category,
    lowStock,
    sortBy = 'updatedAt',
    sortOrder = 'desc'
  } = req.query;

  const where = { isActive: true };

  // Search by product name
  if (search) {
    where.name = { contains: search };
  }

  // Filter by category
  if (category) {
    where.category = category.toUpperCase();
  }

  // Filter for low stock items (threshold: 10 units)
  if (lowStock === 'true') {
    where.stock = { lte: 10 };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const [products, totalCount] = await Promise.all([
    prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        category: true,
        stock: true,
        price: true,
        images: true,
        isActive: true,
        updatedAt: true,
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
    prisma.product.count({ where }),
  ]);

  // Get stock summary statistics
  const stockSummary = await prisma.product.aggregate({
    where: { isActive: true },
    _sum: { stock: true },
    _avg: { stock: true },
    _count: true,
  });

  const lowStockCount = await prisma.product.count({
    where: { isActive: true, stock: { lte: 10 } },
  });

  const outOfStockCount = await prisma.product.count({
    where: { isActive: true, stock: 0 },
  });

  res.status(200).json({
    success: true,
    message: 'Inventory retrieved successfully',
    data: products,
    summary: {
      totalProducts: stockSummary._count,
      totalStock: stockSummary._sum.stock || 0,
      averageStock: Math.round(stockSummary._avg.stock || 0),
      lowStockCount,
      outOfStockCount,
    },
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / take),
      totalItems: totalCount,
      itemsPerPage: take,
      hasNextPage: parseInt(page) < Math.ceil(totalCount / take),
      hasPrevPage: parseInt(page) > 1,
    },
  });
});

// =============================================================================
// @desc    Update inventory with history logging
// @route   PUT /api/inventory/:productId
// @access  Private/Admin
// =============================================================================

const updateInventoryWithHistory = asyncHandler(async (req, res) => {
  const productId = parseInt(req.params.productId);
  const { quantity, operation = 'set', reason } = req.body;

  // Validation
  if (isNaN(productId)) {
    res.status(400);
    throw new Error('Invalid product ID');
  }

  if (quantity === undefined || isNaN(parseInt(quantity))) {
    res.status(400);
    throw new Error('Quantity is required and must be a number');
  }

  if (!reason || reason.trim() === '') {
    res.status(400);
    throw new Error('Reason for stock update is required');
  }

  // Get current product
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      stock: true,
    },
  });

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  // Calculate new stock based on operation
  let newStock;
  let changeAmount;

  switch (operation) {
    case 'add':
      newStock = product.stock + parseInt(quantity);
      changeAmount = parseInt(quantity);
      break;
    case 'subtract':
      newStock = product.stock - parseInt(quantity);
      changeAmount = -parseInt(quantity);
      if (newStock < 0) {
        res.status(400);
        throw new Error('Insufficient stock. Cannot subtract more than available.');
      }
      break;
    case 'set':
    default:
      newStock = parseInt(quantity);
      changeAmount = newStock - product.stock;
      if (newStock < 0) {
        res.status(400);
        throw new Error('Stock cannot be negative');
      }
  }

  // Update stock and create inventory log in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update product stock
    const updatedProduct = await tx.product.update({
      where: { id: productId },
      data: { stock: newStock },
      select: {
        id: true,
        name: true,
        category: true,
        stock: true,
        updatedAt: true,
      },
    });

    // Create inventory log entry
    const inventoryLog = await tx.inventoryLog.create({
      data: {
        productId: productId,
        previousStock: product.stock,
        newStock: newStock,
        changeAmount: changeAmount,
        changeType: 'MANUAL_ADJUSTMENT',
        reason: reason,
        changedById: req.user.id, // Admin who made the change
      },
      include: {
        changedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return { updatedProduct, inventoryLog };
  });

  res.status(200).json({
    success: true,
    message: `Stock updated successfully from ${product.stock} to ${newStock}`,
    data: {
      product: result.updatedProduct,
      log: result.inventoryLog,
    },
  });
});

// =============================================================================
// @desc    Get inventory change history for a product
// @route   GET /api/inventory/history/:productId
// @access  Private/Admin
// =============================================================================

const getInventoryHistory = asyncHandler(async (req, res) => {
  const productId = parseInt(req.params.productId);
  const { page = 1, limit = 20 } = req.query;

  if (isNaN(productId)) {
    res.status(400);
    throw new Error('Invalid product ID');
  }

  // Check if product exists
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, stock: true },
  });

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const [history, totalCount] = await Promise.all([
    prisma.inventoryLog.findMany({
      where: { productId: productId },
      include: {
        changedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' }, // Most recent first
      skip,
      take,
    }),
    prisma.inventoryLog.count({ where: { productId: productId } }),
  ]);

  res.status(200).json({
    success: true,
    message: 'Inventory history retrieved successfully',
    data: {
      product: product,
      history: history,
    },
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / take),
      totalItems: totalCount,
      itemsPerPage: take,
      hasNextPage: parseInt(page) < Math.ceil(totalCount / take),
      hasPrevPage: parseInt(page) > 1,
    },
  });
});

// =============================================================================
// @desc    Get low stock alerts
// @route   GET /api/inventory/alerts
// @access  Private/Admin
// =============================================================================

const getInventoryAlerts = asyncHandler(async (req, res) => {
  const { threshold = 10 } = req.query;

  const lowStockProducts = await prisma.product.findMany({
    where: {
      isActive: true,
      stock: { lte: parseInt(threshold) },
    },
    select: {
      id: true,
      name: true,
      category: true,
      stock: true,
      price: true,
      images: true,
      updatedAt: true,
    },
    orderBy: { stock: 'asc' }, // Most critical first
  });

  // Categorize alerts by severity
  const outOfStock = lowStockProducts.filter(p => p.stock === 0);
  const criticalLow = lowStockProducts.filter(p => p.stock > 0 && p.stock <= 5);
  const low = lowStockProducts.filter(p => p.stock > 5 && p.stock <= parseInt(threshold));

  res.status(200).json({
    success: true,
    message: 'Low stock alerts retrieved successfully',
    data: {
      all: lowStockProducts,
      categorized: {
        outOfStock: outOfStock,
        criticalLow: criticalLow,
        low: low,
      },
    },
    summary: {
      totalAlerts: lowStockProducts.length,
      outOfStockCount: outOfStock.length,
      criticalLowCount: criticalLow.length,
      lowCount: low.length,
    },
  });
});

module.exports = {
  getInventoryOverview,
  updateInventoryWithHistory,
  getInventoryHistory,
  getInventoryAlerts,
};
