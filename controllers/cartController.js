// =============================================================================
// CART CONTROLLER - Cart Management
// =============================================================================
// 
// Based on Section 5.4 (Cart Management) of the SRS:
// - 5.4.1 Add to Cart (SRS-41 to SRS-43)
// - 5.4.2 View Cart (SRS-44, SRS-45)
// - 5.4.3 Remove Product from Cart (SRS-46 to SRS-48)
//
// This controller handles shopping cart functionality.
//
// =============================================================================

const { prisma } = require('../config/db');
const { asyncHandler } = require('../middleware/errorMiddleware');

// =============================================================================
// HELPER: Get or create user's active cart
// =============================================================================

const getOrCreateCart = async (userId) => {
  // Find active cart
  let cart = await prisma.cart.findFirst({
    where: {
      userId: userId,
      isActive: true,
    },
  });
  
  // Create new cart if none exists
  if (!cart) {
    cart = await prisma.cart.create({
      data: {
        userId: userId,
        isActive: true,
      },
    });
  }
  
  return cart;
};

// =============================================================================
// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private
// =============================================================================
// 
// Based on SRS-44, SRS-45:
// - View all products in cart
// - Shows product name, image, quantity, price

const getCart = asyncHandler(async (req, res) => {
  // Get or create cart
  const cart = await getOrCreateCart(req.user.id);
  
  // Get cart with items
  const cartWithItems = await prisma.cart.findUnique({
    where: { id: cart.id },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              discountPrice: true,
              images: true,
              stock: true,
              isActive: true,
              category: true,
            },
          },
        },
        orderBy: { addedAt: 'desc' },
      },
    },
  });
  
  // Calculate totals
  let subtotal = 0;
  let totalItems = 0;
  
  const items = cartWithItems.items.map(item => {
    // Use discount price if available
    const currentPrice = item.product.discountPrice || item.product.price;
    const itemTotal = parseFloat(currentPrice) * item.quantity;
    
    subtotal += itemTotal;
    totalItems += item.quantity;
    
    return {
      id: item.id,
      quantity: item.quantity,
      priceAtTime: item.priceAtTime,
      currentPrice: currentPrice,
      itemTotal: itemTotal.toFixed(2),
      customization: item.customization,
      addedAt: item.addedAt,
      product: item.product,
      // SRS-45: product name, image, quantity, price
      inStock: item.product.stock >= item.quantity,
    };
  });
  
  res.status(200).json({
    success: true,
    data: {
      cartId: cart.id,
      items,
      summary: {
        totalItems,
        subtotal: subtotal.toFixed(2),
        // Shipping, tax, discounts would be calculated at checkout
      },
    },
  });
});

// =============================================================================
// @desc    Add product to cart
// @route   POST /api/cart/add
// @access  Private
// =============================================================================
// 
// Based on SRS-41, SRS-42, SRS-43:
// - Users can add products easily
// - System saves to cart
// - Confirmation message shown

const addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity = 1, customization } = req.body;
  
  // Validate input
  if (!productId) {
    res.status(400);
    throw new Error('Product ID is required');
  }
  
  const prodId = parseInt(productId);
  const qty = parseInt(quantity);
  
  if (isNaN(prodId) || isNaN(qty) || qty < 1) {
    res.status(400);
    throw new Error('Invalid product ID or quantity');
  }
  
  // Check if product exists and is available
  const product = await prisma.product.findUnique({
    where: { id: prodId },
  });
  
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }
  
  if (!product.isActive) {
    res.status(400);
    throw new Error('This product is no longer available');
  }
  
  // Check stock
  if (product.stock < qty) {
    res.status(400);
    throw new Error(`Insufficient stock. Only ${product.stock} available.`);
  }
  
  // Get or create cart
  const cart = await getOrCreateCart(req.user.id);
  
  // Check if product already in cart
  const existingItem = await prisma.cartItem.findUnique({
    where: {
      cartId_productId: {
        cartId: cart.id,
        productId: prodId,
      },
    },
  });
  
  let cartItem;
  
  if (existingItem) {
    // Update quantity if already in cart (SRS-42)
    const newQuantity = existingItem.quantity + qty;
    
    // Check stock for new quantity
    if (product.stock < newQuantity) {
      res.status(400);
      throw new Error(`Cannot add ${qty} more. Only ${product.stock - existingItem.quantity} more available.`);
    }
    
    cartItem = await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: {
        quantity: newQuantity,
        // Update customization if provided
        customization: customization || existingItem.customization,
      },
      include: {
        product: {
          select: {
            name: true,
            price: true,
            images: true,
          },
        },
      },
    });
  } else {
    // Add new item to cart (SRS-42)
    const currentPrice = product.discountPrice || product.price;
    
    cartItem = await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: prodId,
        quantity: qty,
        priceAtTime: currentPrice,
        customization: customization || null, // SRS-19, SRS-20: custom choices
      },
      include: {
        product: {
          select: {
            name: true,
            price: true,
            images: true,
          },
        },
      },
    });
  }
  
  // Get updated cart summary
  const cartItems = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
  });
  
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  
  // SRS-43: Confirmation message
  res.status(200).json({
    success: true,
    message: `${product.name} added to cart successfully! (SRS-43)`,
    data: {
      item: cartItem,
      cartSummary: {
        totalItems,
      },
    },
  });
});

// =============================================================================
// @desc    Update cart item quantity
// @route   PUT /api/cart/item/:itemId
// @access  Private
// =============================================================================

const updateCartItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const { quantity, customization } = req.body;
  
  const cartItemId = parseInt(itemId);
  
  if (isNaN(cartItemId)) {
    res.status(400);
    throw new Error('Invalid item ID');
  }
  
  // Find cart item
  const cartItem = await prisma.cartItem.findUnique({
    where: { id: cartItemId },
    include: {
      cart: true,
      product: true,
    },
  });
  
  if (!cartItem) {
    res.status(404);
    throw new Error('Cart item not found');
  }
  
  // Verify ownership
  if (cartItem.cart.userId !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to modify this cart');
  }
  
  // Validate quantity
  if (quantity !== undefined) {
    const qty = parseInt(quantity);
    
    if (isNaN(qty) || qty < 1) {
      res.status(400);
      throw new Error('Quantity must be at least 1');
    }
    
    // Check stock
    if (cartItem.product.stock < qty) {
      res.status(400);
      throw new Error(`Only ${cartItem.product.stock} available in stock`);
    }
  }
  
  // Update item
  const updateData = {};
  if (quantity !== undefined) updateData.quantity = parseInt(quantity);
  if (customization !== undefined) updateData.customization = customization;
  
  const updatedItem = await prisma.cartItem.update({
    where: { id: cartItemId },
    data: updateData,
    include: {
      product: {
        select: {
          name: true,
          price: true,
          discountPrice: true,
          images: true,
        },
      },
    },
  });
  
  res.status(200).json({
    success: true,
    message: 'Cart item updated',
    data: updatedItem,
  });
});

// =============================================================================
// @desc    Remove product from cart
// @route   DELETE /api/cart/item/:itemId
// @access  Private
// =============================================================================
// 
// Based on SRS-46, SRS-47, SRS-48:
// - Users can remove products
// - Each has remove button
// - Total updates automatically

const removeFromCart = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const cartItemId = parseInt(itemId);
  
  if (isNaN(cartItemId)) {
    res.status(400);
    throw new Error('Invalid item ID');
  }
  
  // Find cart item
  const cartItem = await prisma.cartItem.findUnique({
    where: { id: cartItemId },
    include: {
      cart: true,
      product: {
        select: { name: true },
      },
    },
  });
  
  if (!cartItem) {
    res.status(404);
    throw new Error('Cart item not found');
  }
  
  // Verify ownership
  if (cartItem.cart.userId !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to modify this cart');
  }
  
  // Delete item (SRS-46, SRS-47)
  await prisma.cartItem.delete({
    where: { id: cartItemId },
  });
  
  // Get updated cart totals (SRS-48: total updates automatically)
  const remainingItems = await prisma.cartItem.findMany({
    where: { cartId: cartItem.cart.id },
    include: {
      product: {
        select: { price: true, discountPrice: true },
      },
    },
  });
  
  let subtotal = 0;
  let totalItems = 0;
  
  remainingItems.forEach(item => {
    const price = item.product.discountPrice || item.product.price;
    subtotal += parseFloat(price) * item.quantity;
    totalItems += item.quantity;
  });
  
  res.status(200).json({
    success: true,
    message: `${cartItem.product.name} removed from cart`,
    data: {
      // SRS-48: Updated totals
      cartSummary: {
        totalItems,
        subtotal: subtotal.toFixed(2),
      },
    },
  });
});

// =============================================================================
// @desc    Clear entire cart
// @route   DELETE /api/cart/clear
// @access  Private
// =============================================================================

const clearCart = asyncHandler(async (req, res) => {
  // Get user's active cart
  const cart = await prisma.cart.findFirst({
    where: {
      userId: req.user.id,
      isActive: true,
    },
  });
  
  if (!cart) {
    return res.status(200).json({
      success: true,
      message: 'Cart is already empty',
    });
  }
  
  // Delete all items
  await prisma.cartItem.deleteMany({
    where: { cartId: cart.id },
  });
  
  res.status(200).json({
    success: true,
    message: 'Cart cleared successfully',
    data: {
      cartSummary: {
        totalItems: 0,
        subtotal: '0.00',
      },
    },
  });
});

// =============================================================================
// @desc    Get cart item count (for header badge)
// @route   GET /api/cart/count
// @access  Private
// =============================================================================

const getCartCount = asyncHandler(async (req, res) => {
  const cart = await prisma.cart.findFirst({
    where: {
      userId: req.user.id,
      isActive: true,
    },
    include: {
      items: {
        select: { quantity: true },
      },
    },
  });
  
  const count = cart
    ? cart.items.reduce((sum, item) => sum + item.quantity, 0)
    : 0;
  
  res.status(200).json({
    success: true,
    data: { count },
  });
});

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartCount,
};
