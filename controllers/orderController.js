// =============================================================================
// ORDER CONTROLLER - Order, Delivery & Tracking Management
// =============================================================================
// 
// Based on SRS Sections:
// - 5.5 Order Management (SRS-49 to SRS-57)
// - 5.7 Delivery Management (SRS-64 to SRS-71)
// - 5.8 Order Tracking Management (SRS-72 to SRS-79)
//
// This controller handles the complete order lifecycle.
//
// =============================================================================

const { prisma } = require('../config/db');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { sendEmail, getOrderConfirmationEmail, getOrderStatusEmail } = require('../utils/sendEmail');

// =============================================================================
// HELPER: Generate unique order number
// =============================================================================

const generateOrderNumber = async () => {
  const year = new Date().getFullYear();
  
  // Get count of orders this year
  const count = await prisma.order.count({
    where: {
      createdAt: {
        gte: new Date(`${year}-01-01`),
      },
    },
  });
  
  // Format: RA-YYYY-XXXXXX (RA = Resin Art)
  const orderNumber = `RA-${year}-${String(count + 1).padStart(6, '0')}`;
  
  return orderNumber;
};

// =============================================================================
// @desc    Create new order from cart (Checkout)
// @route   POST /api/orders
// @access  Private
// =============================================================================
// 
// Based on SRS-49, SRS-50:
// - User confirms cart items and places order
// - Confirmation email/SMS sent

const createOrder = asyncHandler(async (req, res) => {
  const {
    shippingAddress,
    shippingPhone,
    paymentMethod,
    notes,
  } = req.body;
  
  // ---------------------------------------------------------------------------
  // Validate input
  // ---------------------------------------------------------------------------
  
  if (!shippingAddress || !shippingPhone) {
    res.status(400);
    throw new Error('Please provide shipping address and phone number');
  }
  
  // ---------------------------------------------------------------------------
  // Get user's cart with items
  // ---------------------------------------------------------------------------
  
  const cart = await prisma.cart.findFirst({
    where: {
      userId: req.user.id,
      isActive: true,
    },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });
  
  if (!cart || cart.items.length === 0) {
    res.status(400);
    throw new Error('Your cart is empty');
  }
  
  // ---------------------------------------------------------------------------
  // Validate stock and calculate totals
  // ---------------------------------------------------------------------------
  
  let subtotal = 0;
  const orderItems = [];
  
  for (const item of cart.items) {
    // Check if product is still active
    if (!item.product.isActive) {
      res.status(400);
      throw new Error(`${item.product.name} is no longer available`);
    }
    
    // Check stock
    if (item.product.stock < item.quantity) {
      res.status(400);
      throw new Error(`Insufficient stock for ${item.product.name}. Only ${item.product.stock} available.`);
    }
    
    // Calculate price
    const unitPrice = item.product.discountPrice || item.product.price;
    const totalPrice = parseFloat(unitPrice) * item.quantity;
    subtotal += totalPrice;
    
    orderItems.push({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: unitPrice,
      totalPrice: totalPrice,
      productName: item.product.name,
      productImage: item.product.images?.[0] || null,
      customization: item.customization,
    });
  }
  
  // Calculate final total (could add shipping, tax, discounts here)
  const shippingCost = subtotal >= 5000 ? 0 : 200; // Free shipping over 5000
  const taxAmount = 0; // No tax for now
  const totalAmount = subtotal + shippingCost + taxAmount;
  
  // ---------------------------------------------------------------------------
  // Create order with transaction
  // ---------------------------------------------------------------------------
  // 
  // PRISMA TRANSACTION:
  // Ensures all operations succeed or all fail together
  // Maintains data integrity
  
  const orderNumber = await generateOrderNumber();
  
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create order
    const order = await tx.order.create({
      data: {
        orderNumber,
        userId: req.user.id,
        status: 'PENDING',
        subtotal,
        shippingCost,
        taxAmount,
        totalAmount,
        shippingAddress,
        shippingPhone,
        notes: notes || null,
        // Create order items
        items: {
          create: orderItems,
        },
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true,
              },
            },
          },
        },
      },
    });
    
    // 2. Update product stock
    for (const item of cart.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: { decrement: item.quantity },
        },
      });
    }
    
    // 3. Create initial tracking entry
    await tx.orderTracking.create({
      data: {
        orderId: order.id,
        status: 'Order Placed',
        description: 'Your order has been placed successfully',
      },
    });
    
    // 4. Clear the cart items
    await tx.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    // 5. Delete the cart (it's empty now, and deleting avoids unique constraint issues)
    // Note: A new cart will be automatically created when user adds items next time
    await tx.cart.delete({
      where: { id: cart.id },
    });
    
    return order;
  });
  
  // ---------------------------------------------------------------------------
  // Send confirmation email (SRS-50)
  // ---------------------------------------------------------------------------
  
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });
    
    const { subject, text, html } = getOrderConfirmationEmail(result, user);
    await sendEmail({ to: user.email, subject, text, html });
  } catch (emailError) {
    console.error('Failed to send order confirmation email:', emailError.message);
  }
  
  // ---------------------------------------------------------------------------
  // Response
  // ---------------------------------------------------------------------------
  
  res.status(201).json({
    success: true,
    message: 'Order placed successfully! Check your email for confirmation. (SRS-50)',
    data: result,
  });
});

// =============================================================================
// @desc    Get user's orders
// @route   GET /api/orders
// @access  Private
// =============================================================================
// 
// Based on SRS-53, SRS-54: View pending orders with details

const getMyOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  
  const where = { userId: req.user.id };
  
  if (status) {
    where.status = status.toUpperCase();
  }
  
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;
  
  const [orders, totalCount] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true,
              },
            },
          },
        },
        payment: {
          select: {
            status: true,
            method: true,
          },
        },
        delivery: {
          select: {
            status: true,
            trackingNumber: true,
            estimatedDelivery: true,
          },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);
  
  res.status(200).json({
    success: true,
    count: orders.length,
    pagination: {
      currentPage: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      totalItems: totalCount,
    },
    data: orders,
  });
});

// =============================================================================
// @desc    Get single order details
// @route   GET /api/orders/:id
// @access  Private
// =============================================================================
// 
// Based on SRS-72, SRS-73: View order status anytime

const getOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const orderId = parseInt(id);
  
  if (isNaN(orderId)) {
    res.status(400);
    throw new Error('Invalid order ID');
  }
  
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              images: true,
              price: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      payment: true,
      delivery: true,
      trackingHistory: {
        orderBy: { timestamp: 'desc' },
      },
    },
  });
  
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  
  // Check authorization (user can only see their own orders, admin can see all)
  if (order.userId !== req.user.id && req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized to view this order');
  }
  
  res.status(200).json({
    success: true,
    data: order,
  });
});

// =============================================================================
// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private
// =============================================================================
// 
// Based on SRS-55, SRS-56, SRS-57:
// - Users can cancel before processing
// - System updates status and notifies
// - Admin can cancel with reason

const cancelOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  
  const orderId = parseInt(id);
  
  if (isNaN(orderId)) {
    res.status(400);
    throw new Error('Invalid order ID');
  }
  
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      user: true,
    },
  });
  
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  
  // Check authorization
  const isAdmin = req.user.role === 'ADMIN';
  const isOwner = order.userId === req.user.id;
  
  if (!isAdmin && !isOwner) {
    res.status(403);
    throw new Error('Not authorized to cancel this order');
  }
  
  // SRS-55: Can only cancel before processing/shipping
  const cancellableStatuses = ['PENDING', 'CONFIRMED'];
  if (!isAdmin && !cancellableStatuses.includes(order.status)) {
    res.status(400);
    throw new Error('Order cannot be cancelled at this stage. Please contact support.');
  }
  
  // SRS-57: Admin needs reason
  if (isAdmin && !isOwner && !reason) {
    res.status(400);
    throw new Error('Admin must provide a reason for cancellation');
  }
  
  // Cancel order and restore stock
  await prisma.$transaction(async (tx) => {
    // Update order status
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: reason || 'Cancelled by customer',
      },
    });
    
    // Restore product stock
    for (const item of order.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: { increment: item.quantity },
        },
      });
    }
    
    // Add tracking entry
    await tx.orderTracking.create({
      data: {
        orderId: orderId,
        status: 'Cancelled',
        description: reason || 'Order cancelled by customer',
        updatedBy: req.user.id,
      },
    });
  });
  
  // SRS-56: Notify user
  try {
    const { subject, text, html } = getOrderStatusEmail(order, order.user, 'CANCELLED');
    await sendEmail({ to: order.user.email, subject, text, html });
  } catch (emailError) {
    console.error('Failed to send cancellation email:', emailError.message);
  }
  
  res.status(200).json({
    success: true,
    message: 'Order cancelled successfully (SRS-56)',
  });
});

// =============================================================================
// @desc    Update order status (Admin)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
// =============================================================================
// 
// Based on SRS-51, SRS-52, SRS-74, SRS-75:
// - Admin updates order status
// - User receives notification

const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, description, trackingNumber, courierCompany } = req.body;
  
  const orderId = parseInt(id);
  
  if (isNaN(orderId)) {
    res.status(400);
    throw new Error('Invalid order ID');
  }
  
  // Validate status
  const validStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
  if (!status || !validStatuses.includes(status.toUpperCase())) {
    res.status(400);
    throw new Error(`Invalid status. Valid options: ${validStatuses.join(', ')}`);
  }
  
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true },
  });
  
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  
  // Prepare update data
  const updateData = {
    status: status.toUpperCase(),
  };
  
  // Set timestamps based on status
  const newStatus = status.toUpperCase();
  if (newStatus === 'CONFIRMED') updateData.confirmedAt = new Date();
  if (newStatus === 'SHIPPED') updateData.shippedAt = new Date();
  if (newStatus === 'DELIVERED') updateData.deliveredAt = new Date();
  
  // Update order
  await prisma.$transaction(async (tx) => {
    // Update order
    await tx.order.update({
      where: { id: orderId },
      data: updateData,
    });
    
    // Add tracking entry (SRS-74)
    await tx.orderTracking.create({
      data: {
        orderId: orderId,
        status: newStatus,
        description: description || `Order status updated to ${newStatus}`,
        updatedBy: req.user.id,
      },
    });
    
    // Create/update delivery record if shipping
    if (newStatus === 'SHIPPED' || trackingNumber || courierCompany) {
      await tx.delivery.upsert({
        where: { orderId: orderId },
        create: {
          orderId: orderId,
          status: newStatus === 'SHIPPED' ? 'SHIPPED' : 'PENDING',
          trackingNumber: trackingNumber || null,
          courierCompany: courierCompany || null,
          address: order.shippingAddress,
          city: '', // Would come from parsed address
          country: 'Pakistan',
        },
        update: {
          status: newStatus === 'DELIVERED' ? 'DELIVERED' : 'SHIPPED',
          trackingNumber: trackingNumber || undefined,
          courierCompany: courierCompany || undefined,
          actualDelivery: newStatus === 'DELIVERED' ? new Date() : undefined,
        },
      });
    }
  });
  
  // SRS-75: Notify user
  try {
    const { subject, text, html } = getOrderStatusEmail(
      { ...order, delivery: { trackingNumber } },
      order.user,
      newStatus
    );
    await sendEmail({ to: order.user.email, subject, text, html });
  } catch (emailError) {
    console.error('Failed to send status update email:', emailError.message);
  }
  
  res.status(200).json({
    success: true,
    message: `Order status updated to ${newStatus}. Customer notified. (SRS-75)`,
  });
});

// =============================================================================
// @desc    Get all orders (Admin)
// @route   GET /api/orders/all
// @access  Private/Admin
// =============================================================================

const getAllOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10, sort = '-createdAt' } = req.query;
  
  const where = {};
  if (status) {
    where.status = status.toUpperCase();
  }
  
  let orderBy = {};
  if (sort.startsWith('-')) {
    orderBy[sort.substring(1)] = 'desc';
  } else {
    orderBy[sort] = 'asc';
  }
  
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;
  
  const [orders, totalCount] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      orderBy,
      skip,
      take: limitNum,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true,
                price: true,
              },
            },
          },
        },
        payment: {
          select: {
            status: true,
            method: true,
            amount: true,
          },
        },
        delivery: {
          select: {
            status: true,
            trackingNumber: true,
            courierCompany: true,
            courierContact: true,
          },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);
  
  res.status(200).json({
    success: true,
    count: orders.length,
    pagination: {
      currentPage: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      totalItems: totalCount,
    },
    data: orders,
  });
});

// =============================================================================
// @desc    Get order tracking history
// @route   GET /api/orders/:id/tracking
// @access  Private
// =============================================================================
// 
// Based on SRS-72, SRS-73, SRS-76: Real-time tracking

const getOrderTracking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const orderId = parseInt(id);
  
  if (isNaN(orderId)) {
    res.status(400);
    throw new Error('Invalid order ID');
  }
  
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      userId: true,
    },
  });
  
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  
  // Check authorization
  if (order.userId !== req.user.id && req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized');
  }
  
  // Get tracking history and delivery info
  const [trackingHistory, delivery] = await prisma.$transaction([
    prisma.orderTracking.findMany({
      where: { orderId },
      orderBy: { timestamp: 'desc' },
    }),
    prisma.delivery.findUnique({
      where: { orderId },
    }),
  ]);
  
  res.status(200).json({
    success: true,
    data: {
      orderNumber: order.orderNumber,
      currentStatus: order.status,
      delivery: delivery ? {
        status: delivery.status,
        courierCompany: delivery.courierCompany, // SRS-78
        courierContact: delivery.courierContact, // SRS-79
        trackingNumber: delivery.trackingNumber,
        trackingUrl: delivery.trackingUrl, // SRS-77
        estimatedDelivery: delivery.estimatedDelivery,
        actualDelivery: delivery.actualDelivery,
      } : null,
      trackingHistory,
    },
  });
});

// =============================================================================
// @desc    Get order statistics (Admin)
// @route   GET /api/orders/stats
// @access  Private/Admin
// =============================================================================

const getOrderStats = asyncHandler(async (req, res) => {
  const [
    totalOrders,
    pendingOrders,
    processingOrders,
    shippedOrders,
    deliveredOrders,
    cancelledOrders,
    todayOrders,
    todayRevenue,
  ] = await prisma.$transaction([
    prisma.order.count(),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.order.count({ where: { status: 'PROCESSING' } }),
    prisma.order.count({ where: { status: 'SHIPPED' } }),
    prisma.order.count({ where: { status: 'DELIVERED' } }),
    prisma.order.count({ where: { status: 'CANCELLED' } }),
    prisma.order.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
    prisma.order.aggregate({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
        status: { not: 'CANCELLED' },
      },
      _sum: { totalAmount: true },
    }),
  ]);
  
  res.status(200).json({
    success: true,
    data: {
      totalOrders,
      pendingOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      todayOrders,
      todayRevenue: todayRevenue._sum.totalAmount || 0,
    },
  });
});

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  createOrder,
  getMyOrders,
  getOrder,
  cancelOrder,
  updateOrderStatus,
  getAllOrders,
  getOrderTracking,
  getOrderStats,
};
