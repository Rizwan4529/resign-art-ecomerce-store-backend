// =============================================================================
// USER CONTROLLER - User Management
// =============================================================================
//
// Based on Section 5.3 (User Management) of the SRS:
// - 5.3.1 Block User (SRS-29 to SRS-31)
// - 5.3.2 Unblock User (SRS-32 to SRS-34)
// - 5.3.3 User Profiles (SRS-35 to SRS-37)
// - 5.3.4 View Users (SRS-38 to SRS-40)
//
// This controller handles admin operations for managing users.
//
// =============================================================================

const bcrypt = require('bcryptjs');
const { prisma } = require('../config/db');
const { asyncHandler } = require('../middleware/errorMiddleware');

// =============================================================================
// @desc    Get all users (Admin)
// @route   GET /api/users
// @access  Private/Admin
// =============================================================================
// 
// Based on SRS-38, SRS-39:
// - Admin can view list of all users
// - Shows key details: name, email, registration date, status

const getUsers = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    status,
    role,
    sort = '-createdAt',
  } = req.query;
  
  // Build where clause
  const where = {};
  
  // Search by name or email
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
    ];
  }
  
  // Filter by status (SRS-32: view blocked users)
  if (status) {
    where.status = status.toUpperCase();
  }
  
  // Filter by role
  if (role) {
    where.role = role.toUpperCase();
  }
  
  // Build order by
  let orderBy = {};
  if (sort.startsWith('-')) {
    orderBy[sort.substring(1)] = 'desc';
  } else {
    orderBy[sort] = 'asc';
  }
  
  // Pagination
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;
  
  // Execute queries
  const [users, totalCount] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy,
      skip,
      take: limitNum,
      select: {
        // SRS-39: key details
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        profileImage: true,
        createdAt: true,
        updatedAt: true,
        // Include counts for admin view (SRS-40)
        _count: {
          select: {
            orders: true,
            reviews: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);
  
  res.status(200).json({
    success: true,
    count: users.length,
    pagination: {
      currentPage: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      totalItems: totalCount,
    },
    data: users,
  });
});

// =============================================================================
// @desc    Get single user by ID (Admin)
// @route   GET /api/users/:id
// @access  Private/Admin
// =============================================================================
// 
// Based on SRS-40: Admin can click to view full details

const getUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = parseInt(id);
  
  if (isNaN(userId)) {
    res.status(400);
    throw new Error('Invalid user ID');
  }
  
  // SRS-40: Full details including profile, order history, feedback
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      address: true,
      dateOfBirth: true,
      role: true,
      status: true,
      profileImage: true,
      createdAt: true,
      updatedAt: true,
      // Order history
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          createdAt: true,
        },
      },
      // Feedback/Reviews
      reviews: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          product: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      // Stats
      _count: {
        select: {
          orders: true,
          reviews: true,
        },
      },
    },
  });
  
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  
  res.status(200).json({
    success: true,
    data: user,
  });
});

// =============================================================================
// @desc    Block user (Admin)
// @route   PUT /api/users/:id/block
// @access  Private/Admin
// =============================================================================
// 
// Based on SRS-29, SRS-30, SRS-31:
// - Admin clicks "Block"
// - User restricted from logging in
// - User marked as "Blocked" in list

const blockUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body; // Optional reason for blocking
  
  const userId = parseInt(id);
  
  if (isNaN(userId)) {
    res.status(400);
    throw new Error('Invalid user ID');
  }
  
  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  
  // Can't block admins
  if (user.role === 'ADMIN') {
    res.status(400);
    throw new Error('Cannot block admin users');
  }
  
  // Can't block yourself
  if (user.id === req.user.id) {
    res.status(400);
    throw new Error('Cannot block yourself');
  }
  
  // Already blocked?
  if (user.status === 'BLOCKED') {
    res.status(400);
    throw new Error('User is already blocked');
  }
  
  // Block user (SRS-30, SRS-31)
  const blockedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      status: 'BLOCKED',
      // Could store block reason in a separate table or JSON field
    },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
    },
  });
  
  res.status(200).json({
    success: true,
    message: `User "${blockedUser.name}" has been blocked successfully. (SRS-31)`,
    data: blockedUser,
  });
});

// =============================================================================
// @desc    Unblock user (Admin)
// @route   PUT /api/users/:id/unblock
// @access  Private/Admin
// =============================================================================
// 
// Based on SRS-32, SRS-33, SRS-34:
// - Admin can view blocked users
// - Each has "Unblock" button
// - User regains full access

const unblockUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = parseInt(id);
  
  if (isNaN(userId)) {
    res.status(400);
    throw new Error('Invalid user ID');
  }
  
  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  
  // Check if user is blocked
  if (user.status !== 'BLOCKED') {
    res.status(400);
    throw new Error('User is not blocked');
  }
  
  // Unblock user (SRS-34)
  const unblockedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      status: 'ACTIVE',
    },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
    },
  });
  
  res.status(200).json({
    success: true,
    message: `User "${unblockedUser.name}" has been unblocked and regained full access. (SRS-34)`,
    data: unblockedUser,
  });
});

// =============================================================================
// @desc    Get blocked users (Admin)
// @route   GET /api/users/blocked
// @access  Private/Admin
// =============================================================================
// 
// Based on SRS-32: Admin can view all blocked users

const getBlockedUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;
  
  const [users, totalCount] = await prisma.$transaction([
    prisma.user.findMany({
      where: { status: 'BLOCKED' },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limitNum,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.count({ where: { status: 'BLOCKED' } }),
  ]);
  
  res.status(200).json({
    success: true,
    count: users.length,
    pagination: {
      currentPage: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      totalItems: totalCount,
    },
    data: users,
  });
});

// =============================================================================
// @desc    Update user role (Admin)
// @route   PUT /api/users/:id/role
// @access  Private/Admin
// =============================================================================

const updateUserRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  
  const userId = parseInt(id);
  
  if (isNaN(userId)) {
    res.status(400);
    throw new Error('Invalid user ID');
  }
  
  if (!role || !['USER', 'ADMIN'].includes(role.toUpperCase())) {
    res.status(400);
    throw new Error('Invalid role. Must be USER or ADMIN');
  }
  
  // Can't change your own role
  if (userId === req.user.id) {
    res.status(400);
    throw new Error('Cannot change your own role');
  }
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { role: role.toUpperCase() },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });
  
  res.status(200).json({
    success: true,
    message: `User role updated to ${updatedUser.role}`,
    data: updatedUser,
  });
});

// =============================================================================
// @desc    Delete user (Admin)
// @route   DELETE /api/users/:id
// @access  Private/Admin
// =============================================================================

const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = parseInt(id);
  
  if (isNaN(userId)) {
    res.status(400);
    throw new Error('Invalid user ID');
  }
  
  // Can't delete yourself
  if (userId === req.user.id) {
    res.status(400);
    throw new Error('Cannot delete your own account');
  }
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: {
          orders: true,
        },
      },
    },
  });
  
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  
  // Can't delete admins
  if (user.role === 'ADMIN') {
    res.status(400);
    throw new Error('Cannot delete admin users');
  }
  
  // If user has orders, soft delete (set to INACTIVE)
  if (user._count.orders > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'INACTIVE' },
    });
    
    return res.status(200).json({
      success: true,
      message: 'User deactivated (has order history)',
    });
  }
  
  // Hard delete if no orders
  // Delete related data first
  await prisma.$transaction([
    prisma.review.deleteMany({ where: { userId } }),
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.cartItem.deleteMany({ where: { cart: { userId } } }),
    prisma.cart.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
  
  res.status(200).json({
    success: true,
    message: 'User deleted successfully',
  });
});

// =============================================================================
// @desc    Get user statistics (Admin)
// @route   GET /api/users/stats
// @access  Private/Admin
// =============================================================================

const getUserStats = asyncHandler(async (req, res) => {
  // Get various user statistics
  const [
    totalUsers,
    activeUsers,
    blockedUsers,
    adminUsers,
    newUsersThisMonth,
  ] = await prisma.$transaction([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count({ where: { status: 'BLOCKED' } }),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.user.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setDate(1)), // First day of current month
        },
      },
    }),
  ]);

  // Get users by month (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const usersByMonth = await prisma.user.groupBy({
    by: ['createdAt'],
    where: {
      createdAt: { gte: sixMonthsAgo },
    },
    _count: { id: true },
  });

  res.status(200).json({
    success: true,
    data: {
      totalUsers,
      activeUsers,
      blockedUsers,
      adminUsers,
      newUsersThisMonth,
      regularUsers: totalUsers - adminUsers,
    },
  });
});

// =============================================================================
// @desc    Reset user password (Admin)
// @route   PUT /api/users/:id/reset-password
// @access  Private/Admin
// =============================================================================
//
// Admin can reset any user's password without email verification
// This is an alternative to email-based password reset

const resetUserPassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  const userId = parseInt(id);

  // Validate user ID
  if (isNaN(userId)) {
    res.status(400);
    throw new Error('Invalid user ID');
  }

  // Validate new password
  if (!newPassword || newPassword.length < 6) {
    res.status(400);
    throw new Error('Password must be at least 6 characters long');
  }

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
    },
  });

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Hash the new password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      // Clear any existing reset tokens
      resetPasswordToken: null,
      resetPasswordExpire: null,
    },
  });

  res.status(200).json({
    success: true,
    message: `Password for user "${user.name}" has been reset successfully`,
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });
});

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  getUsers,
  getUser,
  blockUser,
  unblockUser,
  getBlockedUsers,
  updateUserRole,
  deleteUser,
  getUserStats,
  resetUserPassword,
};
