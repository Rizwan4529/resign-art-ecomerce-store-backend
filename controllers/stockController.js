// =============================================================================
// STOCK CONTROLLER - Stock Management
// =============================================================================
// 
// Based on Section 5.9 (Stock Management) of the SRS:
// - 5.9.1 Update Stock Level (SRS-82, 83)
// - 5.9.2 Low Stock Alert (SRS-84, 85)
// - 5.9.3 Stock History (SRS-86, 87)
//
// =============================================================================

const { prisma } = require('../config/db');
const { asyncHandler } = require('../middleware/errorMiddleware');

// =============================================================================
// @desc    Get all stock levels
// @route   GET /api/stock
// @access  Private/Admin
// =============================================================================

const getStockLevels = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 20, 
    lowStock,
    category,
    sortBy = 'stock',
    sortOrder = 'asc' 
  } = req.query;

  const where = { isActive: true };

  // Filter for low stock items (SRS-84)
  if (lowStock === 'true') {
    where.stock = { lte: 10 }; // Low stock threshold
  }

  if (category) {
    where.category = category.toUpperCase();
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

  // Get stock summary
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
      totalCount,
    },
  });
});

// =============================================================================
// @desc    Update stock level for a product
// @route   PUT /api/stock/:productId
// @access  Private/Admin
// =============================================================================
// Based on SRS-82, SRS-83: Admin updates stock levels

const updateStock = asyncHandler(async (req, res) => {
  const productId = parseInt(req.params.productId);
  const { quantity, operation = 'set' } = req.body;
  // operation: 'set' (set exact value), 'add' (increase), 'subtract' (decrease)

  if (isNaN(productId)) {
    res.status(400);
    throw new Error('Invalid product ID');
  }

  if (quantity === undefined || isNaN(parseInt(quantity))) {
    res.status(400);
    throw new Error('Quantity is required');
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  let newStock;
  switch (operation) {
    case 'add':
      newStock = product.stock + parseInt(quantity);
      break;
    case 'subtract':
      newStock = product.stock - parseInt(quantity);
      if (newStock < 0) {
        res.status(400);
        throw new Error('Insufficient stock');
      }
      break;
    case 'set':
    default:
      newStock = parseInt(quantity);
      if (newStock < 0) {
        res.status(400);
        throw new Error('Stock cannot be negative');
      }
  }

  // Update stock and log the change in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const updatedProduct = await tx.product.update({
      where: { id: productId },
      data: { stock: newStock },
      select: {
        id: true,
        name: true,
        stock: true,
        updatedAt: true,
      },
    });

    // Create inventory log entry if user is authenticated
    if (req.user && req.user.id) {
      await tx.inventoryLog.create({
        data: {
          productId: productId,
          previousStock: product.stock,
          newStock: newStock,
          changeAmount: newStock - product.stock,
          changeType: 'MANUAL_ADJUSTMENT',
          reason: `Stock ${operation} operation`,
          changedById: req.user.id,
        },
      });
    }

    return updatedProduct;
  });

  res.status(200).json({
    success: true,
    message: `Stock updated successfully. New stock: ${newStock} (SRS-83)`,
    data: result,
  });
});

// =============================================================================
// @desc    Get low stock alerts
// @route   GET /api/stock/alerts
// @access  Private/Admin
// =============================================================================
// Based on SRS-84, SRS-85: System alerts admin for low stock

const getLowStockAlerts = asyncHandler(async (req, res) => {
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
    },
    orderBy: { stock: 'asc' },
  });

  // Categorize alerts
  const outOfStock = lowStockProducts.filter(p => p.stock === 0);
  const criticalLow = lowStockProducts.filter(p => p.stock > 0 && p.stock <= 5);
  const low = lowStockProducts.filter(p => p.stock > 5 && p.stock <= threshold);

  res.status(200).json({
    success: true,
    message: `Found ${lowStockProducts.length} products with low stock (SRS-85)`,
    data: {
      outOfStock: {
        count: outOfStock.length,
        products: outOfStock,
      },
      criticalLow: {
        count: criticalLow.length,
        products: criticalLow,
      },
      low: {
        count: low.length,
        products: low,
      },
    },
    totalAlerts: lowStockProducts.length,
  });
});

// =============================================================================
// @desc    Bulk update stock
// @route   PUT /api/stock/bulk
// @access  Private/Admin
// =============================================================================

const bulkUpdateStock = asyncHandler(async (req, res) => {
  const { updates } = req.body;
  // updates: [{ productId: 1, quantity: 50 }, ...]

  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    res.status(400);
    throw new Error('Updates array is required');
  }

  const results = await prisma.$transaction(
    updates.map(({ productId, quantity }) =>
      prisma.product.update({
        where: { id: parseInt(productId) },
        data: { stock: parseInt(quantity) },
        select: { id: true, name: true, stock: true },
      })
    )
  );

  res.status(200).json({
    success: true,
    message: `Updated stock for ${results.length} products`,
    data: results,
  });
});

// =============================================================================
// @desc    Get stock report by category
// @route   GET /api/stock/report
// @access  Private/Admin
// =============================================================================
// Based on SRS-86, SRS-87: Stock history and reports

const getStockReport = asyncHandler(async (req, res) => {
  // Group stock by category
  const categoryStats = await prisma.product.groupBy({
    by: ['category'],
    where: { isActive: true },
    _sum: { stock: true },
    _avg: { stock: true },
    _count: true,
  });

  // Get products by stock status
  const stockDistribution = await Promise.all([
    prisma.product.count({ where: { isActive: true, stock: 0 } }),
    prisma.product.count({ where: { isActive: true, stock: { gte: 1, lte: 10 } } }),
    prisma.product.count({ where: { isActive: true, stock: { gte: 11, lte: 50 } } }),
    prisma.product.count({ where: { isActive: true, stock: { gt: 50 } } }),
  ]);

  // Calculate total stock value
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { stock: true, price: true },
  });

  const totalStockValue = products.reduce(
    (sum, p) => sum + (p.stock * parseFloat(p.price)),
    0
  );

  res.status(200).json({
    success: true,
    data: {
      byCategory: categoryStats.map(cat => ({
        category: cat.category,
        totalStock: cat._sum.stock || 0,
        averageStock: Math.round(cat._avg.stock || 0),
        productCount: cat._count,
      })),
      stockDistribution: {
        outOfStock: stockDistribution[0],
        lowStock: stockDistribution[1],
        mediumStock: stockDistribution[2],
        highStock: stockDistribution[3],
      },
      totalStockValue: Math.round(totalStockValue * 100) / 100,
    },
  });
});

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  getStockLevels,
  updateStock,
  getLowStockAlerts,
  bulkUpdateStock,
  getStockReport,
};
