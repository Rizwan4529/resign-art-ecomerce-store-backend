// =============================================================================
// PAYMENT CONTROLLER - Payment Management
// =============================================================================
// 
// Based on Section 5.6 (Payment Management) of the SRS:
// - 5.6.1 Payment Method (SRS-58, SRS-59)
// - 5.6.2 View Payment (SRS-60, SRS-61)
// - 5.6.3 Pending Payment (SRS-62, SRS-63)
//
// This controller handles payment processing and management.
//
// NOTE: This is a simplified implementation. In production, you would
// integrate with actual payment gateways (Stripe, JazzCash, Easypaisa, etc.)
//
// =============================================================================

const { prisma } = require('../config/db');
const { asyncHandler } = require('../middleware/errorMiddleware');

// =============================================================================
// @desc    Process payment for an order
// @route   POST /api/payments
// @access  Private
// =============================================================================
// 
// Based on SRS-58, SRS-59:
// - Allow different payment methods
// - User selects preferred method

const processPayment = asyncHandler(async (req, res) => {
  const { orderId, method, transactionId } = req.body;
  
  // ---------------------------------------------------------------------------
  // Validate input
  // ---------------------------------------------------------------------------
  
  if (!orderId || !method) {
    res.status(400);
    throw new Error('Order ID and payment method are required');
  }
  
  const orderIdNum = parseInt(orderId);
  
  if (isNaN(orderIdNum)) {
    res.status(400);
    throw new Error('Invalid order ID');
  }
  
  // Validate payment method (SRS-58)
  const validMethods = ['CREDIT_CARD', 'DEBIT_CARD', 'EASYPAISA', 'JAZZCASH', 'BANK_TRANSFER', 'COD'];
  if (!validMethods.includes(method.toUpperCase())) {
    res.status(400);
    throw new Error(`Invalid payment method. Valid options: ${validMethods.join(', ')}`);
  }
  
  // ---------------------------------------------------------------------------
  // Check order exists and belongs to user
  // ---------------------------------------------------------------------------
  
  const order = await prisma.order.findUnique({
    where: { id: orderIdNum },
    include: {
      payment: true,
    },
  });
  
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  
  if (order.userId !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to pay for this order');
  }
  
  // Check if already paid
  if (order.payment && order.payment.status === 'COMPLETED') {
    res.status(400);
    throw new Error('This order has already been paid');
  }
  
  // Check order status
  if (order.status === 'CANCELLED') {
    res.status(400);
    throw new Error('Cannot pay for a cancelled order');
  }
  
  // ---------------------------------------------------------------------------
  // Process payment
  // ---------------------------------------------------------------------------
  // 
  // In a real application, you would:
  // 1. Call the payment gateway API
  // 2. Verify the transaction
  // 3. Handle success/failure callbacks
  //
  // For COD, payment is marked as pending until delivery
  
  const paymentMethod = method.toUpperCase();
  const isCOD = paymentMethod === 'COD';
  
  // Create or update payment record
  const payment = await prisma.payment.upsert({
    where: { orderId: orderIdNum },
    create: {
      orderId: orderIdNum,
      userId: req.user.id,
      method: paymentMethod,
      status: isCOD ? 'PENDING' : 'COMPLETED', // COD is pending until delivery
      amount: order.totalAmount,
      transactionId: transactionId || null,
      paidAt: isCOD ? null : new Date(),
    },
    update: {
      method: paymentMethod,
      status: isCOD ? 'PENDING' : 'COMPLETED',
      transactionId: transactionId || null,
      paidAt: isCOD ? null : new Date(),
    },
  });
  
  // Update order status if payment successful (not COD)
  if (!isCOD) {
    await prisma.$transaction([
      prisma.order.update({
        where: { id: orderIdNum },
        data: { status: 'CONFIRMED' },
      }),
      prisma.orderTracking.create({
        data: {
          orderId: orderIdNum,
          status: 'Payment Received',
          description: `Payment of Rs. ${order.totalAmount} received via ${paymentMethod}`,
        },
      }),
    ]);
  }
  
  res.status(200).json({
    success: true,
    message: isCOD 
      ? 'Order confirmed for Cash on Delivery. Pay when you receive your order.'
      : 'Payment successful! Your order is being processed.',
    data: {
      payment: {
        id: payment.id,
        method: payment.method,
        status: payment.status,
        amount: payment.amount,
        transactionId: payment.transactionId,
        paidAt: payment.paidAt,
      },
    },
  });
});

// =============================================================================
// @desc    Get payment details for an order
// @route   GET /api/payments/order/:orderId
// @access  Private
// =============================================================================
// 
// Based on SRS-60, SRS-61:
// - View payment details (amount, method, date)
// - Display payment status (Paid, Failed, Pending)

const getPaymentByOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const orderIdNum = parseInt(orderId);
  
  if (isNaN(orderIdNum)) {
    res.status(400);
    throw new Error('Invalid order ID');
  }
  
  // Get order with payment
  const order = await prisma.order.findUnique({
    where: { id: orderIdNum },
    select: {
      id: true,
      orderNumber: true,
      userId: true,
      totalAmount: true,
    },
  });
  
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  
  // Check authorization
  if (order.userId !== req.user.id && req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized to view this payment');
  }
  
  // Get payment (SRS-60)
  const payment = await prisma.payment.findUnique({
    where: { orderId: orderIdNum },
    select: {
      id: true,
      method: true,
      status: true, // SRS-61
      amount: true,
      transactionId: true,
      paidAt: true,
      createdAt: true,
    },
  });
  
  res.status(200).json({
    success: true,
    data: {
      orderNumber: order.orderNumber,
      orderTotal: order.totalAmount,
      payment: payment || {
        status: 'NOT_INITIATED',
        message: 'Payment not yet processed',
      },
    },
  });
});

// =============================================================================
// @desc    Get user's payment history
// @route   GET /api/payments
// @access  Private
// =============================================================================

const getMyPayments = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  
  const where = { userId: req.user.id };
  
  if (status) {
    where.status = status.toUpperCase();
  }
  
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;
  
  const [payments, totalCount] = await prisma.$transaction([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
          },
        },
      },
    }),
    prisma.payment.count({ where }),
  ]);
  
  res.status(200).json({
    success: true,
    count: payments.length,
    pagination: {
      currentPage: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      totalItems: totalCount,
    },
    data: payments,
  });
});

// =============================================================================
// @desc    Retry payment for pending order
// @route   POST /api/payments/retry/:orderId
// @access  Private
// =============================================================================
// 
// Based on SRS-63: Users can retry payment for pending orders

const retryPayment = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { method, transactionId } = req.body;
  
  const orderIdNum = parseInt(orderId);
  
  if (isNaN(orderIdNum)) {
    res.status(400);
    throw new Error('Invalid order ID');
  }
  
  // Check order and existing payment
  const order = await prisma.order.findUnique({
    where: { id: orderIdNum },
    include: {
      payment: true,
    },
  });
  
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  
  if (order.userId !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized');
  }
  
  // SRS-63: Can only retry if payment is pending or failed
  if (order.payment && !['PENDING', 'FAILED'].includes(order.payment.status)) {
    res.status(400);
    throw new Error('Payment cannot be retried for this order');
  }
  
  // Process new payment
  const paymentMethod = (method || order.payment?.method || 'COD').toUpperCase();
  
  const payment = await prisma.payment.upsert({
    where: { orderId: orderIdNum },
    create: {
      orderId: orderIdNum,
      userId: req.user.id,
      method: paymentMethod,
      status: paymentMethod === 'COD' ? 'PENDING' : 'COMPLETED',
      amount: order.totalAmount,
      transactionId: transactionId || null,
      paidAt: paymentMethod === 'COD' ? null : new Date(),
    },
    update: {
      method: paymentMethod,
      status: paymentMethod === 'COD' ? 'PENDING' : 'COMPLETED',
      transactionId: transactionId || null,
      paidAt: paymentMethod === 'COD' ? null : new Date(),
      failedAt: null,
      failureReason: null,
    },
  });
  
  // Update order if payment successful
  if (paymentMethod !== 'COD') {
    await prisma.order.update({
      where: { id: orderIdNum },
      data: { status: 'CONFIRMED' },
    });
  }
  
  res.status(200).json({
    success: true,
    message: 'Payment processed successfully! (SRS-63)',
    data: payment,
  });
});

// =============================================================================
// @desc    Get all payments (Admin)
// @route   GET /api/payments/all
// @access  Private/Admin
// =============================================================================

const getAllPayments = asyncHandler(async (req, res) => {
  const { status, method, page = 1, limit = 10 } = req.query;
  
  const where = {};
  if (status) where.status = status.toUpperCase();
  if (method) where.method = method.toUpperCase();
  
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;
  
  const [payments, totalCount] = await prisma.$transaction([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
          },
        },
      },
    }),
    prisma.payment.count({ where }),
  ]);
  
  res.status(200).json({
    success: true,
    count: payments.length,
    pagination: {
      currentPage: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      totalItems: totalCount,
    },
    data: payments,
  });
});

// =============================================================================
// @desc    Get pending payments (Admin)
// @route   GET /api/payments/pending
// @access  Private/Admin
// =============================================================================
// 
// Based on SRS-62: System marks incomplete payments as pending

const getPendingPayments = asyncHandler(async (req, res) => {
  const payments = await prisma.payment.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
        },
      },
    },
  });
  
  res.status(200).json({
    success: true,
    count: payments.length,
    data: payments,
  });
});

// =============================================================================
// @desc    Update payment status (Admin)
// @route   PUT /api/payments/:id/status
// @access  Private/Admin
// =============================================================================

const updatePaymentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, transactionId, failureReason } = req.body;
  
  const paymentId = parseInt(id);
  
  if (isNaN(paymentId)) {
    res.status(400);
    throw new Error('Invalid payment ID');
  }
  
  const validStatuses = ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'];
  if (!status || !validStatuses.includes(status.toUpperCase())) {
    res.status(400);
    throw new Error(`Invalid status. Valid options: ${validStatuses.join(', ')}`);
  }
  
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });
  
  if (!payment) {
    res.status(404);
    throw new Error('Payment not found');
  }
  
  const updateData = {
    status: status.toUpperCase(),
  };
  
  if (status.toUpperCase() === 'COMPLETED') {
    updateData.paidAt = new Date();
  }
  
  if (status.toUpperCase() === 'FAILED') {
    updateData.failedAt = new Date();
    updateData.failureReason = failureReason || 'Payment failed';
  }
  
  if (transactionId) {
    updateData.transactionId = transactionId;
  }
  
  const updatedPayment = await prisma.payment.update({
    where: { id: paymentId },
    data: updateData,
  });
  
  res.status(200).json({
    success: true,
    message: `Payment status updated to ${status.toUpperCase()}`,
    data: updatedPayment,
  });
});

// =============================================================================
// @desc    Get payment statistics (Admin)
// @route   GET /api/payments/stats
// @access  Private/Admin
// =============================================================================

const getPaymentStats = asyncHandler(async (req, res) => {
  const [
    totalPayments,
    completedPayments,
    pendingPayments,
    failedPayments,
    totalRevenue,
    todayRevenue,
    paymentsByMethod,
  ] = await prisma.$transaction([
    prisma.payment.count(),
    prisma.payment.count({ where: { status: 'COMPLETED' } }),
    prisma.payment.count({ where: { status: 'PENDING' } }),
    prisma.payment.count({ where: { status: 'FAILED' } }),
    prisma.payment.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: {
        status: 'COMPLETED',
        paidAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
      _sum: { amount: true },
    }),
    prisma.payment.groupBy({
      by: ['method'],
      where: { status: 'COMPLETED' },
      _count: { method: true },
      _sum: { amount: true },
    }),
  ]);
  
  res.status(200).json({
    success: true,
    data: {
      totalPayments,
      completedPayments,
      pendingPayments,
      failedPayments,
      totalRevenue: totalRevenue._sum.amount || 0,
      todayRevenue: todayRevenue._sum.amount || 0,
      paymentsByMethod: paymentsByMethod.map(pm => ({
        method: pm.method,
        count: pm._count.method,
        total: pm._sum.amount || 0,
      })),
    },
  });
});

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  processPayment,
  getPaymentByOrder,
  getMyPayments,
  retryPayment,
  getAllPayments,
  getPendingPayments,
  updatePaymentStatus,
  getPaymentStats,
};
