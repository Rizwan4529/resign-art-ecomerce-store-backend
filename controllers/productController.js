// =============================================================================
// PRODUCT CONTROLLER - Product Management
// =============================================================================
//
// Based on Section 5.2 (Product Management) of the SRS:
// - 5.2.1 Add Product (SRS-13 to SRS-15)
// - 5.2.2 Search Product (SRS-16 to SRS-18)
// - 5.2.3 Customize Product (SRS-19, SRS-20)
// - 5.2.4 Delete Product (SRS-21 to SRS-23)
// - 5.2.5 Update Product (SRS-24 to SRS-26)
// - 5.2.6 View All Products (SRS-27, SRS-28)
//
// Also includes Section 5.11 (360 Degree Product View) functionality.
//
// =============================================================================

const { prisma } = require("../config/db");
const { asyncHandler } = require("../middleware/errorMiddleware");

// =============================================================================
// @desc    Get all products with filtering, sorting, and pagination
// @route   GET /api/products
// @access  Public
// =============================================================================
//
// Based on SRS-16, SRS-17, SRS-18, SRS-27, SRS-28:
// - Search by keywords (name, category, price range)
// - Filter by price, category, popularity
// - Quick response times
//
// QUERY PARAMETERS:
// - search: Search by name or description
// - category: Filter by category
// - minPrice, maxPrice: Price range filter
// - featured: Filter featured products
// - inStock: Filter in-stock products
// - page, limit: Pagination
// - sort: Sorting (price, -price, createdAt, -createdAt, rating)

const getProducts = asyncHandler(async (req, res) => {
  // ---------------------------------------------------------------------------
  // STEP 1: Extract query parameters
  // ---------------------------------------------------------------------------

  const {
    search,
    category,
    minPrice,
    maxPrice,
    featured,
    inStock,
    page = 1,
    limit = 10,
    sort = "-createdAt", // Default: newest first
  } = req.query;

  // ---------------------------------------------------------------------------
  // STEP 2: Build WHERE clause for filtering
  // ---------------------------------------------------------------------------
  //
  // PRISMA WHERE SYNTAX:
  // - Simple: { field: value }
  // - AND: { AND: [condition1, condition2] }
  // - OR: { OR: [condition1, condition2] }
  // - Operators: { field: { gt: 10, lt: 100 } }
  // - Contains: { field: { contains: 'text' } }

  const where = {
    isActive: true, // Only show active products
  };

  // Search filter (SRS-16: search by keywords)
  if (search) {
    // Search in name and description
    where.OR = [
      { name: { contains: search } },
      { description: { contains: search } },
      { brand: { contains: search } },
    ];
  }

  // Category filter (SRS-18: filter by category)
  if (category) {
    where.category = category;
  }

  // Price range filter (SRS-18: filter by price - uses discountPrice if available, otherwise price)
  if (minPrice || maxPrice) {
    const minVal = minPrice ? parseFloat(minPrice) : null;
    const maxVal = maxPrice ? parseFloat(maxPrice) : null;

    // Build price OR condition: check discountPrice if it exists, otherwise check price
    const priceFilters = [];

    // Condition 1: Product has discountPrice and it's in range
    if (minVal !== null && maxVal !== null) {
      priceFilters.push({
        AND: [
          { discountPrice: { not: null } },
          { discountPrice: { gte: minVal } },
          { discountPrice: { lte: maxVal } },
        ],
      });
    } else if (minVal !== null) {
      priceFilters.push({
        AND: [
          { discountPrice: { not: null } },
          { discountPrice: { gte: minVal } },
        ],
      });
    } else if (maxVal !== null) {
      priceFilters.push({
        AND: [
          { discountPrice: { not: null } },
          { discountPrice: { lte: maxVal } },
        ],
      });
    }

    // Condition 2: Product has NO discountPrice and normal price is in range
    if (minVal !== null && maxVal !== null) {
      priceFilters.push({
        AND: [
          { discountPrice: null },
          { price: { gte: minVal } },
          { price: { lte: maxVal } },
        ],
      });
    } else if (minVal !== null) {
      priceFilters.push({
        AND: [{ discountPrice: null }, { price: { gte: minVal } }],
      });
    } else if (maxVal !== null) {
      priceFilters.push({
        AND: [{ discountPrice: null }, { price: { lte: maxVal } }],
      });
    }

    // Combine with existing filters
    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: priceFilters }];
      delete where.OR;
    } else {
      where.OR = priceFilters;
    }
  }

  // Featured filter
  if (featured === "true") {
    where.isFeatured = true;
  }

  // In stock filter
  if (inStock === "true") {
    where.stock = { gt: 0 };
  }

  // ---------------------------------------------------------------------------
  // STEP 3: Build ORDER BY clause for sorting
  // ---------------------------------------------------------------------------
  //
  // Sort format: "field" (ascending) or "-field" (descending)
  // PRISMA orderBy: { field: 'asc' } or { field: 'desc' }

  let orderBy = {};

  if (sort.startsWith("-")) {
    // Descending order (e.g., "-price" means highest price first)
    orderBy[sort.substring(1)] = "desc";
  } else {
    // Ascending order
    orderBy[sort] = "asc";
  }

  // Handle special sort cases
  if (sort === "rating" || sort === "-rating") {
    orderBy = { averageRating: sort.startsWith("-") ? "desc" : "asc" };
  }

  // ---------------------------------------------------------------------------
  // STEP 4: Calculate pagination
  // ---------------------------------------------------------------------------
  //
  // PRISMA pagination:
  // - skip: Number of records to skip
  // - take: Number of records to return

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  // ---------------------------------------------------------------------------
  // STEP 5: Execute queries
  // ---------------------------------------------------------------------------
  //
  // We run two queries:
  // 1. Get products with pagination
  // 2. Count total products (for pagination info)
  //
  // PRISMA TRANSACTION:
  // $transaction runs multiple queries efficiently

  const [products, totalCount] = await prisma.$transaction([
    // Query 1: Get products
    prisma.product.findMany({
      where,
      orderBy,
      skip,
      take: limitNum,
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        discountPrice: true,
        category: true,
        brand: true,
        stock: true,
        images: true,
        model3dUrl: true,
        tags: true,
        isActive: true,
        isFeatured: true,
        isCustomizable: true,
        averageRating: true,
        totalReviews: true,
        createdAt: true,
        // Include creator info
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),

    // Query 2: Count total
    prisma.product.count({ where }),
  ]);

  // ---------------------------------------------------------------------------
  // STEP 6: Send response with pagination info
  // ---------------------------------------------------------------------------

  const totalPages = Math.ceil(totalCount / limitNum);

  res.status(200).json({
    success: true,
    count: products.length,
    pagination: {
      currentPage: pageNum,
      totalPages,
      totalItems: totalCount,
      itemsPerPage: limitNum,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
    },
    data: products,
  });
});

// =============================================================================
// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Public
// =============================================================================
//
// Returns detailed product info including reviews.
// Supports 360-degree view via model3dUrl field (Section 5.11)

const getProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Validate ID
  const productId = parseInt(id);
  if (isNaN(productId)) {
    res.status(400);
    throw new Error("Invalid product ID");
  }

  // Get product with related data
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      // Include creator info
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      // Include reviews (SRS-89: feedback shown under product)
      reviews: {
        where: { isApproved: true },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              profileImage: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10, // Latest 10 reviews
      },
    },
  });

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  // Check if product is active (unless admin is requesting)
  if (!product.isActive && (!req.user || req.user.role !== "ADMIN")) {
    res.status(404);
    throw new Error("Product not found");
  }

  res.status(200).json({
    success: true,
    data: product,
  });
});

// =============================================================================
// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
// =============================================================================

const getFeaturedProducts = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 8;

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      isFeatured: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      price: true,
      discountPrice: true,
      images: true,
      averageRating: true,
      totalReviews: true,
      category: true,
    },
  });

  res.status(200).json({
    success: true,
    count: products.length,
    data: products,
  });
});

// =============================================================================
// @desc    Get products by category
// @route   GET /api/products/category/:category
// @access  Public
// =============================================================================

const getProductsByCategory = asyncHandler(async (req, res) => {
  const { category } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  const [products, totalCount] = await prisma.$transaction([
    prisma.product.findMany({
      where: {
        isActive: true,
        category: category.toUpperCase(),
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limitNum,
    }),
    prisma.product.count({
      where: {
        isActive: true,
        category: category.toUpperCase(),
      },
    }),
  ]);

  res.status(200).json({
    success: true,
    count: products.length,
    pagination: {
      currentPage: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      totalItems: totalCount,
    },
    data: products,
  });
});

// =============================================================================
// @desc    Create new product
// @route   POST /api/products
// @access  Private/Admin
// =============================================================================
//
// Based on SRS-13, SRS-14, SRS-15:
// - Admin fills in product details
// - System saves to database
// - Confirmation message shown

const createProduct = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    price,
    discountPrice,
    category,
    brand,
    stock,
    model3dUrl,
    tags,
    specifications,
    isFeatured,
    isCustomizable,
  } = req.body;

  // ---------------------------------------------------------------------------
  // Handle uploaded images from FormData
  // ---------------------------------------------------------------------------

  // Get image paths from uploaded files
  const imageUrls = req.files
    ? req.files.map((file) => `/uploads/products/${file.filename}`)
    : [];

  // Parse tags if sent as JSON string
  let parsedTags = [];
  if (tags) {
    try {
      parsedTags = typeof tags === "string" ? JSON.parse(tags) : tags;
    } catch (e) {
      parsedTags = [];
    }
  }

  // ---------------------------------------------------------------------------
  // Validate required fields (SRS-13)
  // ---------------------------------------------------------------------------

  if (!name || !description || !price || !category) {
    res.status(400);
    throw new Error("Please provide name, description, price, and category");
  }

  // Validate price
  if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
    res.status(400);
    throw new Error("Price must be a valid positive number");
  }

  // Validate category enum
  const validCategories = [
    "JEWELRY",
    "HOME_DECOR",
    "COASTERS",
    "KEYCHAINS",
    "WALL_ART",
    "TRAYS",
    "BOOKMARKS",
    "PHONE_CASES",
    "CLOCKS",
    "CUSTOM",
  ];

  if (!validCategories.includes(category.toUpperCase())) {
    res.status(400);
    throw new Error(
      `Invalid category. Valid options: ${validCategories.join(", ")}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Create product (SRS-14)
  // ---------------------------------------------------------------------------

  const product = await prisma.product.create({
    data: {
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price),
      discountPrice: discountPrice ? parseFloat(discountPrice) : null,
      category: category.toUpperCase(),
      brand: brand || null,
      stock: stock ? parseInt(stock) : 0,
      images: imageUrls, // Use uploaded image URLs
      model3dUrl: model3dUrl || null, // Section 5.11: 3D model URL
      tags: parsedTags, // Use parsed tags
      specifications: specifications || {},
      isFeatured: isFeatured === "true" || isFeatured === true,
      isCustomizable: isCustomizable === "true" || isCustomizable === true,
      createdById: req.user.id, // Admin who created this
    },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // ---------------------------------------------------------------------------
  // Send response (SRS-15: confirmation message)
  // ---------------------------------------------------------------------------

  res.status(201).json({
    success: true,
    message: "Product created successfully! (SRS-15)",
    data: product,
  });
});

// =============================================================================
// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Admin
// =============================================================================
//
// Based on SRS-24, SRS-25, SRS-26:
// - Admin can edit product details
// - Changes saved immediately
// - Confirmation message shown

const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const productId = parseInt(id);

  if (isNaN(productId)) {
    res.status(400);
    throw new Error("Invalid product ID");
  }

  // Check if product exists
  const existingProduct = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!existingProduct) {
    res.status(404);
    throw new Error("Product not found");
  }

  // Build update data (only include provided fields)
  const {
    name,
    description,
    price,
    discountPrice,
    category,
    brand,
    stock,
    existingImages,
    model3dUrl,
    tags,
    specifications,
    isActive,
    isFeatured,
    isCustomizable,
  } = req.body;

  // ---------------------------------------------------------------------------
  // Handle images (existing + newly uploaded)
  // ---------------------------------------------------------------------------

  // Get newly uploaded image files
  const newImageUrls = req.files
    ? req.files.map((file) => `/uploads/products/${file.filename}`)
    : [];

  // Parse existing images to keep (sent as JSON string from frontend)
  let existingImageUrls = [];
  if (existingImages) {
    try {
      existingImageUrls =
        typeof existingImages === "string"
          ? JSON.parse(existingImages)
          : existingImages;
    } catch (e) {
      existingImageUrls = [];
    }
  }

  // Combine existing images (that user wants to keep) with newly uploaded images
  const combinedImages = [...existingImageUrls, ...newImageUrls];

  // ---------------------------------------------------------------------------
  // Parse tags if sent as JSON string
  // ---------------------------------------------------------------------------

  let parsedTags;
  if (tags !== undefined) {
    try {
      parsedTags = typeof tags === "string" ? JSON.parse(tags) : tags;
    } catch (e) {
      parsedTags = tags;
    }
  }

  // ---------------------------------------------------------------------------
  // Build update data
  // ---------------------------------------------------------------------------

  const updateData = {};

  if (name !== undefined) updateData.name = name.trim();
  if (description !== undefined) updateData.description = description.trim();
  if (price !== undefined) updateData.price = parseFloat(price);
  if (discountPrice !== undefined) {
    updateData.discountPrice = discountPrice ? parseFloat(discountPrice) : null;
  }
  if (category !== undefined) updateData.category = category.toUpperCase();
  if (brand !== undefined) updateData.brand = brand;
  if (stock !== undefined) updateData.stock = parseInt(stock);

  // Only update images if there are new uploads or existing images were modified
  if (existingImages !== undefined || req.files) {
    updateData.images = combinedImages;
  }

  if (model3dUrl !== undefined) updateData.model3dUrl = model3dUrl;
  if (parsedTags !== undefined) updateData.tags = parsedTags;
  if (specifications !== undefined) updateData.specifications = specifications;
  if (isActive !== undefined)
    updateData.isActive = isActive === "true" || isActive === true;
  if (isFeatured !== undefined)
    updateData.isFeatured = isFeatured === "true" || isFeatured === true;
  if (isCustomizable !== undefined)
    updateData.isCustomizable =
      isCustomizable === "true" || isCustomizable === true;

  // Update product (SRS-25)
  const updatedProduct = await prisma.product.update({
    where: { id: productId },
    data: updateData,
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // SRS-26: confirmation message
  res.status(200).json({
    success: true,
    message: "Product updated successfully! (SRS-26)",
    data: updatedProduct,
  });
});

// =============================================================================
// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Admin
// =============================================================================
//
// Based on SRS-21, SRS-22, SRS-23:
// - Admin can delete products
// - Confirmation before deletion (handled in frontend)
// - Warn if product has orders/reviews

const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { force } = req.query; // Force delete even with orders

  const productId = parseInt(id);

  if (isNaN(productId)) {
    res.status(400);
    throw new Error("Invalid product ID");
  }

  // Check if product exists with related data
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      _count: {
        select: {
          orderItems: true,
          reviews: true,
        },
      },
    },
  });

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  // SRS-23: Warn if product has orders or reviews
  if (
    (product._count.orderItems > 0 || product._count.reviews > 0) &&
    force !== "true"
  ) {
    return res.status(200).json({
      success: false,
      warning: true,
      message: `This product has ${product._count.orderItems} order(s) and ${product._count.reviews} review(s). Are you sure you want to delete it? Add ?force=true to confirm.`,
      data: {
        orderCount: product._count.orderItems,
        reviewCount: product._count.reviews,
      },
    });
  }

  // If force=true, perform hard delete with cascade
  if (force === "true") {
    // Delete order items that reference this product
    await prisma.orderItem.deleteMany({
      where: { productId: productId },
    });

    // Delete reviews
    await prisma.review.deleteMany({
      where: { productId: productId },
    });

    // Delete cart items
    await prisma.cartItem.deleteMany({
      where: { productId: productId },
    });

    // Delete the product
    await prisma.product.delete({
      where: { id: productId },
    });

    res.status(200).json({
      success: true,
      message: "Product and all related data deleted successfully! (SRS-23)",
    });
  } else {
    // Soft delete (set isActive to false) instead of hard delete
    // This preserves data integrity for orders
    await prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
    });

    res.status(200).json({
      success: true,
      message: "Product deleted successfully! (SRS-23)",
    });
  }
});

// =============================================================================
// @desc    Hard delete product (permanent)
// @route   DELETE /api/products/:id/permanent
// @access  Private/Admin
// =============================================================================

const permanentDeleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const productId = parseInt(id);

  if (isNaN(productId)) {
    res.status(400);
    throw new Error("Invalid product ID");
  }

  // Check if product exists
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      _count: {
        select: {
          orderItems: true,
        },
      },
    },
  });

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  // Don't allow permanent delete if product has orders
  if (product._count.orderItems > 0) {
    res.status(400);
    throw new Error(
      "Cannot permanently delete product with existing orders. Use soft delete instead.",
    );
  }

  // Delete reviews first (cascade)
  await prisma.review.deleteMany({
    where: { productId: productId },
  });

  // Delete cart items
  await prisma.cartItem.deleteMany({
    where: { productId: productId },
  });

  // Delete product
  await prisma.product.delete({
    where: { id: productId },
  });

  res.status(200).json({
    success: true,
    message: "Product permanently deleted!",
  });
});

// =============================================================================
// @desc    Get product categories
// @route   GET /api/products/categories
// @access  Public
// =============================================================================

const getCategories = asyncHandler(async (req, res) => {
  // Get categories with product counts
  const categories = await prisma.product.groupBy({
    by: ["category"],
    where: { isActive: true },
    _count: { category: true },
  });

  const formattedCategories = categories.map((cat) => ({
    name: cat.category,
    count: cat._count.category,
  }));

  res.status(200).json({
    success: true,
    data: formattedCategories,
  });
});

// =============================================================================
// @desc    Search products (advanced search)
// @route   GET /api/products/search
// @access  Public
// =============================================================================
//
// Based on SRS-16, SRS-17: Quick search with matching results

const searchProducts = asyncHandler(async (req, res) => {
  const { q, limit = 10 } = req.query;

  if (!q || q.trim().length < 2) {
    return res.status(200).json({
      success: true,
      data: [],
    });
  }

  const searchTerm = q.trim();

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: searchTerm } },
        { description: { contains: searchTerm } },
        { brand: { contains: searchTerm } },
      ],
    },
    take: parseInt(limit),
    select: {
      id: true,
      name: true,
      price: true,
      images: true,
      category: true,
      averageRating: true,
    },
  });

  res.status(200).json({
    success: true,
    count: products.length,
    data: products,
  });
});

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  getProducts,
  getProduct,
  getFeaturedProducts,
  getProductsByCategory,
  createProduct,
  updateProduct,
  deleteProduct,
  permanentDeleteProduct,
  getCategories,
  searchProducts,
};
