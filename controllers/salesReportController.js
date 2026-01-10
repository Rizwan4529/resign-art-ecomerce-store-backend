// =============================================================================
// SALES REPORT CONTROLLER - Sales Reporting with PDF Generation
// =============================================================================
//
// Handles sales report generation:
// - Calculate sales data from orders
// - Generate PDF reports
// - Track products sold, revenue, and profit margins
//
// =============================================================================

const { prisma } = require('../config/db');
const { asyncHandler } = require('../middleware/errorMiddleware');
const PDFDocument = require('pdfkit');

// =============================================================================
// @desc    Get sales report data (JSON)
// @route   GET /api/reports/sales
// @access  Private/Admin
// =============================================================================

const getSalesReport = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  // Validate date parameters
  if (!startDate || !endDate) {
    res.status(400);
    throw new Error('Start date and end date are required');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    res.status(400);
    throw new Error('Invalid date format');
  }

  if (start > end) {
    res.status(400);
    throw new Error('Start date must be before end date');
  }

  // Set time to cover full days
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  // Get all delivered orders in date range (only count completed sales)
  const orders = await prisma.order.findMany({
    where: {
      status: 'DELIVERED',
      deliveredAt: {
        gte: start,
        lte: end,
      },
    },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              category: true,
              price: true,
            },
          },
        },
      },
      payment: {
        select: {
          status: true,
          amount: true,
        },
      },
    },
  });

  // Calculate summary statistics
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.totalAmount), 0);
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Calculate products sold
  const productsSoldMap = new Map();
  let totalProductsSold = 0;

  orders.forEach(order => {
    order.items.forEach(item => {
      totalProductsSold += item.quantity;

      if (productsSoldMap.has(item.productId)) {
        const existing = productsSoldMap.get(item.productId);
        existing.quantitySold += item.quantity;
        existing.revenue += parseFloat(item.totalPrice);
      } else {
        productsSoldMap.set(item.productId, {
          productId: item.productId,
          productName: item.product?.name || item.productName,
          category: item.product?.category || 'UNKNOWN',
          quantitySold: item.quantity,
          revenue: parseFloat(item.totalPrice),
        });
      }
    });
  });

  const productsSold = Array.from(productsSoldMap.values())
    .sort((a, b) => b.revenue - a.revenue); // Sort by revenue (highest first)

  // Calculate profit margins
  // Get expenses for the same period
  const expenses = await prisma.expense.findMany({
    where: {
      date: {
        gte: start,
        lte: end,
      },
    },
  });

  const totalExpenses = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
  const grossProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  // Prepare response
  const reportData = {
    period: {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    },
    summary: {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOrders: totalOrders,
      totalProductsSold: totalProductsSold,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
    },
    productsSold: productsSold,
    profitMargins: {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      profitMargin: Math.round(profitMargin * 100) / 100,
    },
  };

  res.status(200).json({
    success: true,
    message: 'Sales report generated successfully',
    data: reportData,
  });
});

// =============================================================================
// @desc    Generate sales report PDF
// @route   POST /api/reports/sales/pdf
// @access  Private/Admin
// =============================================================================

const generateSalesPDF = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.body;

  // Validate date parameters
  if (!startDate || !endDate) {
    res.status(400);
    throw new Error('Start date and end date are required');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    res.status(400);
    throw new Error('Invalid date format');
  }

  if (start > end) {
    res.status(400);
    throw new Error('Start date must be before end date');
  }

  // Set time to cover full days
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  // Get sales data (reuse logic from getSalesReport)
  const orders = await prisma.order.findMany({
    where: {
      status: 'DELIVERED',
      deliveredAt: {
        gte: start,
        lte: end,
      },
    },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              category: true,
              price: true,
            },
          },
        },
      },
    },
  });

  // Calculate summary
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.totalAmount), 0);
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Calculate products sold
  const productsSoldMap = new Map();
  let totalProductsSold = 0;

  orders.forEach(order => {
    order.items.forEach(item => {
      totalProductsSold += item.quantity;

      if (productsSoldMap.has(item.productId)) {
        const existing = productsSoldMap.get(item.productId);
        existing.quantitySold += item.quantity;
        existing.revenue += parseFloat(item.totalPrice);
      } else {
        productsSoldMap.set(item.productId, {
          productId: item.productId,
          productName: item.product?.name || item.productName,
          category: item.product?.category || 'UNKNOWN',
          quantitySold: item.quantity,
          revenue: parseFloat(item.totalPrice),
        });
      }
    });
  });

  const productsSold = Array.from(productsSoldMap.values())
    .sort((a, b) => b.revenue - a.revenue);

  // Get expenses
  const expenses = await prisma.expense.findMany({
    where: {
      date: {
        gte: start,
        lte: end,
      },
    },
  });

  const totalExpenses = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
  const grossProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  // Create PDF
  const doc = new PDFDocument({ margin: 50 });

  // Set response headers for PDF download
  const filename = `sales-report-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  // Pipe PDF to response
  doc.pipe(res);

  // ===== PDF HEADER =====
  doc.fontSize(24).font('Helvetica-Bold').text('Sales Report', { align: 'center' });
  doc.moveDown(0.5);

  doc.fontSize(12).font('Helvetica').text(
    `Period: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
    { align: 'center' }
  );
  doc.moveDown(1);

  // ===== SUMMARY SECTION =====
  doc.fontSize(16).font('Helvetica-Bold').text('Summary', { underline: true });
  doc.moveDown(0.5);

  doc.fontSize(11).font('Helvetica');
  doc.text(`Total Revenue: PKR ${totalRevenue.toFixed(2)}`);
  doc.text(`Total Orders: ${totalOrders}`);
  doc.text(`Total Products Sold: ${totalProductsSold}`);
  doc.text(`Average Order Value: PKR ${averageOrderValue.toFixed(2)}`);
  doc.moveDown(1.5);

  // ===== PROFIT MARGINS SECTION =====
  doc.fontSize(16).font('Helvetica-Bold').text('Profit Margins', { underline: true });
  doc.moveDown(0.5);

  doc.fontSize(11).font('Helvetica');
  doc.text(`Total Revenue: PKR ${totalRevenue.toFixed(2)}`);
  doc.text(`Total Expenses: PKR ${totalExpenses.toFixed(2)}`);
  doc.text(`Gross Profit: PKR ${grossProfit.toFixed(2)}`);
  doc.text(`Profit Margin: ${profitMargin.toFixed(2)}%`);
  doc.moveDown(1.5);

  // ===== PRODUCTS SOLD SECTION =====
  doc.fontSize(16).font('Helvetica-Bold').text('Products Sold', { underline: true });
  doc.moveDown(0.5);

  if (productsSold.length === 0) {
    doc.fontSize(11).font('Helvetica').text('No products sold in this period.');
  } else {
    // Table header
    const tableTop = doc.y;
    const col1 = 50;
    const col2 = 250;
    const col3 = 350;
    const col4 = 450;

    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Product Name', col1, tableTop);
    doc.text('Category', col2, tableTop);
    doc.text('Quantity', col3, tableTop);
    doc.text('Revenue (PKR)', col4, tableTop);

    doc.moveTo(col1, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    // Table rows
    let y = tableTop + 25;
    doc.font('Helvetica').fontSize(9);

    productsSold.forEach((product, index) => {
      // Check if we need a new page
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      doc.text(product.productName.substring(0, 30), col1, y);
      doc.text(product.category, col2, y);
      doc.text(product.quantitySold.toString(), col3, y);
      doc.text(product.revenue.toFixed(2), col4, y);

      y += 20;
    });
  }

  // ===== FOOTER =====
  doc.moveDown(2);
  doc.fontSize(8).font('Helvetica').text(
    `Generated on: ${new Date().toLocaleString()}`,
    50,
    doc.page.height - 50,
    { align: 'center' }
  );

  // Finalize PDF
  doc.end();
});

module.exports = {
  getSalesReport,
  generateSalesPDF,
};
