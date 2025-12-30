// =============================================================================
// REVIEW CONTROLLER - Review Management
// =============================================================================
// 
// Based on Section 5.10 (Review Management) of the SRS:
// - 5.10.1 Add Feedback (SRS-88, 89)
// - 5.10.2 View Feedback (SRS-90, 91)
// - 5.10.3 Add Rating (SRS-93, 94)
// - 5.10.4 View Rating (SRS-95, 96)
//
// =============================================================================

const { prisma } = require('../config/db');
const { asyncHandler } = require('../middleware/errorMiddleware');

// =============================================================================
// @desc    Create a review for a product
// @route   POST /api/reviews
// @access  Private
// =============================================================================
// Based on SRS-88, SRS-93: Users can add feedback and rating

const createReview = asyncHandler(async (req, res) => {
  const { productId, rating, comment } = req.body;
  const userId = req.user.id;

  // Validate input
  if (!productId || !rating) {
    res.status(400);
    throw new Error('Product ID and rating are required');
  }

  // Validate rating (1-5)
  if (rating < 1 || rating > 5) {
    res.status(400);
    throw new Error('Rating must be between 1 and 5');
  }

  // Check if product exists
  const product = await prisma.product.findUnique({
    where: { id: parseInt(productId) },
  });

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  // Check if user already reviewed this product (SRS-90: only purchasers can review)
  const existingReview = await prisma.review.findUnique({
    where: {
      userId_productId: {
        userId,
        productId: parseInt(productId),
      },
    },
  });

  if (existingReview) {
    res.status(400);
    throw new Error('You have already reviewed this product');
  }

  // Optionally: Check if user has purchased the product
  // const hasPurchased = await prisma.orderItem.findFirst({
  //   where: {
  //     productId: parseInt(productId),
  //     order: { userId, status: 'DELIVERED' },
  //   },
  // });
  // if (!hasPurchased) {
  //   res.status(403);
  //   throw new Error('You can only review products you have purchased');
  // }

  // Create review
  const review = await prisma.review.create({
    data: {
      userId,
      productId: parseInt(productId),
      rating: parseInt(rating),
      comment: comment || null,
    },
    include: {
      user: {
        select: { id: true, name: true, profileImage: true },
      },
      product: {
        select: { id: true, name: true },
      },
    },
  });

  // Update product's average rating and total reviews
  await updateProductRating(parseInt(productId));

  res.status(201).json({
    success: true,
    message: 'Review added successfully (SRS-89, SRS-94)',
    data: review,
  });
});

// =============================================================================
// @desc    Get reviews for a product
// @route   GET /api/reviews/product/:productId
// @access  Public
// =============================================================================
// Based on SRS-91, SRS-96: View feedback and ratings

const getProductReviews = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const [reviews, totalCount, stats] = await Promise.all([
    prisma.review.findMany({
      where: { productId: parseInt(productId), isApproved: true },
      include: {
        user: {
          select: { id: true, name: true, profileImage: true },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
    prisma.review.count({
      where: { productId: parseInt(productId), isApproved: true },
    }),
    // Get rating distribution
    prisma.review.groupBy({
      by: ['rating'],
      where: { productId: parseInt(productId), isApproved: true },
      _count: { rating: true },
    }),
  ]);

  // Format rating distribution
  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  stats.forEach(s => {
    ratingDistribution[s.rating] = s._count.rating;
  });

  res.status(200).json({
    success: true,
    data: reviews,
    ratingDistribution,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / take),
      totalCount,
    },
  });
});

// =============================================================================
// @desc    Get user's reviews
// @route   GET /api/reviews/my-reviews
// @access  Private
// =============================================================================

const getMyReviews = asyncHandler(async (req, res) => {
  const reviews = await prisma.review.findMany({
    where: { userId: req.user.id },
    include: {
      product: {
        select: { id: true, name: true, images: true, price: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json({
    success: true,
    data: reviews,
  });
});

// =============================================================================
// @desc    Update a review
// @route   PUT /api/reviews/:id
// @access  Private
// =============================================================================

const updateReview = asyncHandler(async (req, res) => {
  const reviewId = parseInt(req.params.id);
  const { rating, comment } = req.body;

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    res.status(404);
    throw new Error('Review not found');
  }

  // Check ownership
  if (review.userId !== req.user.id && req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized to update this review');
  }

  // Validate rating if provided
  if (rating && (rating < 1 || rating > 5)) {
    res.status(400);
    throw new Error('Rating must be between 1 and 5');
  }

  const updatedReview = await prisma.review.update({
    where: { id: reviewId },
    data: {
      ...(rating && { rating: parseInt(rating) }),
      ...(comment !== undefined && { comment }),
    },
    include: {
      user: {
        select: { id: true, name: true },
      },
      product: {
        select: { id: true, name: true },
      },
    },
  });

  // Update product rating if rating changed
  if (rating) {
    await updateProductRating(review.productId);
  }

  res.status(200).json({
    success: true,
    message: 'Review updated successfully',
    data: updatedReview,
  });
});

// =============================================================================
// @desc    Delete a review
// @route   DELETE /api/reviews/:id
// @access  Private
// =============================================================================

const deleteReview = asyncHandler(async (req, res) => {
  const reviewId = parseInt(req.params.id);

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    res.status(404);
    throw new Error('Review not found');
  }

  // Check ownership or admin
  if (review.userId !== req.user.id && req.user.role !== 'ADMIN') {
    res.status(403);
    throw new Error('Not authorized to delete this review');
  }

  const productId = review.productId;

  await prisma.review.delete({
    where: { id: reviewId },
  });

  // Update product rating
  await updateProductRating(productId);

  res.status(200).json({
    success: true,
    message: 'Review deleted successfully',
  });
});

// =============================================================================
// @desc    Get all reviews (Admin)
// @route   GET /api/reviews
// @access  Private/Admin
// =============================================================================

const getAllReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, isApproved, rating } = req.query;

  const where = {};
  if (isApproved !== undefined) {
    where.isApproved = isApproved === 'true';
  }
  if (rating) {
    where.rating = parseInt(rating);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const [reviews, totalCount] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        product: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.review.count({ where }),
  ]);

  res.status(200).json({
    success: true,
    data: reviews,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / take),
      totalCount,
    },
  });
});

// =============================================================================
// @desc    Approve/Disapprove a review (Admin)
// @route   PUT /api/reviews/:id/approve
// @access  Private/Admin
// =============================================================================

const approveReview = asyncHandler(async (req, res) => {
  const reviewId = parseInt(req.params.id);
  const { isApproved } = req.body;

  const review = await prisma.review.update({
    where: { id: reviewId },
    data: { isApproved: isApproved !== false },
  });

  res.status(200).json({
    success: true,
    message: `Review ${review.isApproved ? 'approved' : 'disapproved'}`,
    data: review,
  });
});

// =============================================================================
// HELPER: Update Product Average Rating
// =============================================================================

const updateProductRating = async (productId) => {
  const aggregation = await prisma.review.aggregate({
    where: { productId, isApproved: true },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await prisma.product.update({
    where: { id: productId },
    data: {
      averageRating: aggregation._avg.rating || 0,
      totalReviews: aggregation._count.rating,
    },
  });
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  createReview,
  getProductReviews,
  getMyReviews,
  updateReview,
  deleteReview,
  getAllReviews,
  approveReview,
};
