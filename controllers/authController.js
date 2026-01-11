// =============================================================================
// AUTH CONTROLLER - Security Management
// =============================================================================
//
// Based on Section 5.1 (Security Management) of the SRS:
// - 5.1.1 Process Signup (SRS-1 to SRS-3)
// - 5.1.2 Process Login (SRS-4 to SRS-6)
// - 5.1.3 Change Password (SRS-7 to SRS-9)
// - 5.1.4 Forget Password (SRS-10 to SRS-12)
//
// This controller handles all authentication-related functionality.
//
// =============================================================================

const bcrypt = require("bcryptjs");
// bcryptjs: Library for hashing passwords
// Why bcrypt? It's slow by design, making brute-force attacks harder

const { prisma } = require("../config/db");
// Prisma client for database operations

const {
  generateToken,
  generateResetToken,
  hashResetToken,
} = require("../utils/generateToken");
// Token utilities

const {
  sendEmail,
  getPasswordResetEmail,
  getWelcomeEmail,
} = require("../utils/sendEmail");
// Email utilities

const { asyncHandler } = require("../middleware/errorMiddleware");
// Wrapper for async error handling

// =============================================================================
// @desc    Register a new user (Signup)
// @route   POST /api/auth/signup
// @access  Public
// =============================================================================
//
// Based on SRS-1, SRS-2, SRS-3:
// - Users enter personal details (name, email, password, phone, dob)
// - System checks email uniqueness
// - After success, user gets confirmation
//
// SIGNUP FLOW:
// 1. Validate input data
// 2. Check if email already exists
// 3. Hash the password
// 4. Create user in database
// 5. Generate JWT token
// 6. Send welcome email
// 7. Return token to client

const signup = asyncHandler(async (req, res) => {
  // ---------------------------------------------------------------------------
  // STEP 1: Extract data from request body
  // ---------------------------------------------------------------------------

  const { name, email, password, phone, dateOfBirth, address, role } = req.body;

  // ---------------------------------------------------------------------------
  // STEP 2: Validate required fields
  // ---------------------------------------------------------------------------
  // Basic validation - more detailed validation done in routes with express-validator

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Please provide name, email, and password");
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400);
    throw new Error("Please provide a valid email address");
  }

  // Validate password strength (SRS-8: strong passwords)
  if (password.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters long");
  }

  // ---------------------------------------------------------------------------
  // STEP 3: Check if user already exists (SRS-2: email is unique)
  // ---------------------------------------------------------------------------
  //
  // PRISMA findUnique:
  // - Searches by unique field (email has @unique in schema)
  // - Returns single record or null
  // - More efficient than findFirst for unique fields

  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    // Convert to lowercase for case-insensitive comparison
  });

  if (existingUser) {
    res.status(400);
    throw new Error("A user with this email already exists");
  }

  // ---------------------------------------------------------------------------
  // STEP 4: Hash the password
  // ---------------------------------------------------------------------------
  //
  // BCRYPT HASHING:
  // - genSalt(10): Generates a salt with 10 rounds (recommended)
  // - hash(): Combines password + salt to create hash
  // - More rounds = more secure but slower
  //
  // WHY HASH?
  // - Never store plain text passwords!
  // - If database is compromised, hashes can't be easily reversed
  // - Each password has unique salt, preventing rainbow table attacks

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // ---------------------------------------------------------------------------
  // STEP 5: Create user in database
  // ---------------------------------------------------------------------------
  //
  // PRISMA create:
  // - Creates a new record
  // - Returns the created record
  // - Validates against schema constraints

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      phone: phone || null,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      address: address || null,
      role: role || "USER", // Default role
      status: "ACTIVE", // New users are active
    },
    // Select which fields to return (exclude password!)
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

  // ---------------------------------------------------------------------------
  // STEP 6: Generate JWT token
  // ---------------------------------------------------------------------------

  const token = generateToken(user.id);

  // ---------------------------------------------------------------------------
  // STEP 7: Send welcome email (optional - don't fail if email fails)
  // ---------------------------------------------------------------------------

  try {
    // const { subject, text, html } = getWelcomeEmail(user);
    // await sendEmail({ to: user.email, subject, text, html });
  } catch (emailError) {
    // Log error but don't fail the signup
    console.error("Failed to send welcome email:", emailError.message);
  }

  // ---------------------------------------------------------------------------
  // STEP 8: Send response (SRS-3: confirmation message)
  // ---------------------------------------------------------------------------

  res.status(201).json({
    success: true,
    message: "Account created successfully! Welcome to Resin Art Store.",
    data: {
      user,
      token,
    },
  });
});

// =============================================================================
// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
// =============================================================================
//
// Based on SRS-4, SRS-5, SRS-6:
// - Users login with email and password
// - System verifies credentials
// - If failed, show error message
//
// LOGIN FLOW:
// 1. Validate input
// 2. Find user by email
// 3. Check if user exists and is active
// 4. Compare password with hash
// 5. Generate JWT token
// 6. Return token to client

const login = asyncHandler(async (req, res) => {
  // ---------------------------------------------------------------------------
  // STEP 1: Extract credentials
  // ---------------------------------------------------------------------------

  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    res.status(400);
    throw new Error("Please provide email and password");
  }

  // ---------------------------------------------------------------------------
  // STEP 2: Find user by email
  // ---------------------------------------------------------------------------
  //
  // IMPORTANT: We need to explicitly select password here because
  // it's normally excluded (select: false equivalent in Prisma would be
  // not including it in default select, which we handle in auth middleware)

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    // Select all fields we need including password for comparison
  });

  // ---------------------------------------------------------------------------
  // STEP 3: Check if user exists (SRS-6: error message if failed)
  // ---------------------------------------------------------------------------
  //
  // SECURITY: Don't reveal whether email exists or not
  // Use generic error message for both cases

  if (!user) {
    res.status(401);
    throw new Error("Invalid email or password");
    // Generic message - don't say "user not found"
  }

  // ---------------------------------------------------------------------------
  // STEP 4: Check if user is blocked (Section 5.3.1)
  // ---------------------------------------------------------------------------

  if (user.status === "BLOCKED") {
    res.status(403);
    throw new Error("Your account has been blocked. Please contact support.");
  }

  if (user.status === "INACTIVE") {
    res.status(403);
    throw new Error("Your account is inactive. Please contact support.");
  }

  // ---------------------------------------------------------------------------
  // STEP 5: Compare password (SRS-5: verify credentials)
  // ---------------------------------------------------------------------------
  //
  // bcrypt.compare:
  // - Takes plain password and hashed password
  // - Returns true if they match, false otherwise
  // - Handles the salt extraction automatically

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    res.status(401);
    throw new Error("Invalid email or password");
    // Same generic message as user not found
  }

  // ---------------------------------------------------------------------------
  // STEP 6: Generate token and send response
  // ---------------------------------------------------------------------------

  const token = generateToken(user.id);

  // Remove password from response
  const { password: _, ...userWithoutPassword } = user;

  res.status(200).json({
    success: true,
    message: "Login successful!",
    data: {
      user: userWithoutPassword,
      token,
    },
  });
});

// =============================================================================
// @desc    Get current logged in user profile
// @route   GET /api/auth/me
// @access  Private
// =============================================================================
//
// Returns the profile of the currently authenticated user.
// Used by frontend to get user data after page refresh.

const getMe = asyncHandler(async (req, res) => {
  // req.user is set by protect middleware
  // It already has the user data, but we might want fresh data

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
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
      // Include some related data
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
    throw new Error("User not found");
  }

  res.status(200).json({
    success: true,
    data: user,
  });
});

// =============================================================================
// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
// =============================================================================
//
// Based on SRS-36: Users can update their personal information

const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, address, dateOfBirth, profileImage } = req.body;

  // Build update data object (only include provided fields)
  const updateData = {};

  if (name !== undefined) updateData.name = name.trim();
  if (phone !== undefined) updateData.phone = phone;
  if (address !== undefined) updateData.address = address;
  if (dateOfBirth !== undefined) {
    updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
  }
  if (profileImage !== undefined) updateData.profileImage = profileImage;

  // Check if there's anything to update
  if (Object.keys(updateData).length === 0) {
    res.status(400);
    throw new Error("No fields to update");
  }

  // Update user
  const updatedUser = await prisma.user.update({
    where: { id: req.user.id },
    data: updateData,
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
      updatedAt: true,
    },
  });

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: updatedUser,
  });
});

// =============================================================================
// @desc    Upload profile picture
// @route   POST /api/auth/profile/picture
// @access  Private
// =============================================================================
//
// Upload profile picture for authenticated user
// - Uses multer middleware to handle file upload
// - Stores image in uploads/profiles/ directory
// - Updates user's profileImage field in database

const uploadProfilePicture = asyncHandler(async (req, res) => {
  // ---------------------------------------------------------------------------
  // Validate file upload
  // ---------------------------------------------------------------------------

  if (!req.file) {
    res.status(400);
    throw new Error('Please upload a profile picture');
  }

  // ---------------------------------------------------------------------------
  // Build the profile image URL path
  // ---------------------------------------------------------------------------

  const profileImagePath = `/uploads/profiles/${req.file.filename}`;

  // ---------------------------------------------------------------------------
  // Update user's profileImage in database
  // ---------------------------------------------------------------------------

  const updatedUser = await prisma.user.update({
    where: { id: req.user.id },
    data: { profileImage: profileImagePath },
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
    }
  });

  res.status(200).json({
    success: true,
    message: 'Profile picture uploaded successfully',
    data: { user: updatedUser }
  });
});

// =============================================================================
// @desc    Change password (when logged in)
// @route   PUT /api/auth/change-password
// @access  Private
// =============================================================================
//
// Based on SRS-7, SRS-8, SRS-9:
// - Users can change password when logged in
// - Must provide current password for verification
// - New password must meet strength requirements

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  // ---------------------------------------------------------------------------
  // Validate input
  // ---------------------------------------------------------------------------

  if (!currentPassword || !newPassword || !confirmPassword) {
    res.status(400);
    throw new Error(
      "Please provide current password, new password, and confirmation"
    );
  }

  // Check if new passwords match
  if (newPassword !== confirmPassword) {
    res.status(400);
    throw new Error("New passwords do not match");
  }

  // Check password strength (SRS-8)
  if (newPassword.length < 6) {
    res.status(400);
    throw new Error("New password must be at least 6 characters long");
  }

  // ---------------------------------------------------------------------------
  // Get user with password
  // ---------------------------------------------------------------------------

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
  });

  // ---------------------------------------------------------------------------
  // Verify current password (SRS-7: safely when logged in)
  // ---------------------------------------------------------------------------

  const isCurrentPasswordValid = await bcrypt.compare(
    currentPassword,
    user.password
  );

  if (!isCurrentPasswordValid) {
    res.status(401);
    throw new Error("Current password is incorrect");
  }

  // Check if new password is same as old (SRS-8: not using old passwords)
  const isSameAsOld = await bcrypt.compare(newPassword, user.password);
  if (isSameAsOld) {
    res.status(400);
    throw new Error("New password must be different from current password");
  }

  // ---------------------------------------------------------------------------
  // Hash and update password
  // ---------------------------------------------------------------------------

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  await prisma.user.update({
    where: { id: req.user.id },
    data: { password: hashedPassword },
  });

  // ---------------------------------------------------------------------------
  // Generate new token (optional: invalidate old tokens)
  // ---------------------------------------------------------------------------

  const token = generateToken(user.id);

  res.status(200).json({
    success: true,
    message: "Password changed successfully! (SRS-9)", // SRS-9: success message
    data: { token },
  });
});

// =============================================================================
// @desc    Forgot password - Request reset link
// @route   POST /api/auth/forgot-password
// @access  Public
// =============================================================================
//
// Based on SRS-10, SRS-11:
// - User provides email
// - System sends reset link/token via email
//
// SECURITY CONSIDERATIONS:
// - Don't reveal if email exists (prevents email enumeration)
// - Token expires after 10 minutes
// - Token is hashed before storing

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error("Please provide your email address");
  }

  // ---------------------------------------------------------------------------
  // Find user by email
  // ---------------------------------------------------------------------------

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  // SECURITY: Always return same response whether user exists or not
  // This prevents attackers from discovering which emails are registered

  if (!user) {
    // Don't reveal that email doesn't exist
    res.status(200).json({
      success: true,
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
    return;
  }

  // ---------------------------------------------------------------------------
  // Generate reset token
  // ---------------------------------------------------------------------------
  //
  // We generate two tokens:
  // 1. resetToken - sent to user via email (unhashed)
  // 2. hashedToken - stored in database (hashed)
  //
  // When user clicks link, we hash their token and compare with stored hash

  const { resetToken, hashedToken } = generateResetToken();

  // Token expires in 10 minutes (SRS-11: time-limited)
  const resetExpire = new Date(Date.now() + 10 * 60 * 1000);

  // ---------------------------------------------------------------------------
  // Save hashed token to database
  // ---------------------------------------------------------------------------

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetPasswordToken: hashedToken,
      resetPasswordExpire: resetExpire,
    },
  });

  // ---------------------------------------------------------------------------
  // Send email with reset link (SRS-11)
  // ---------------------------------------------------------------------------

  const resetUrl = `${
    process.env.FRONTEND_URL || "http://localhost:3000"
  }/reset-password?token=${resetToken}`;

  try {
    const { subject, text, html } = getPasswordResetEmail(user.name, resetUrl);
    await sendEmail({ to: user.email, subject, text, html });

    res.status(200).json({
      success: true,
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    // If email fails, clear the reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: null,
        resetPasswordExpire: null,
      },
    });

    res.status(500);
    throw new Error("Failed to send reset email. Please try again later.");
  }
});

// =============================================================================
// @desc    Reset password with token
// @route   POST /api/auth/reset-password/:token
// @access  Public
// =============================================================================
//
// Based on SRS-12:
// - User clicks link with token
// - Provides new password
// - System validates token and updates password
// - Shows confirmation message

const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password, confirmPassword } = req.body;

  // ---------------------------------------------------------------------------
  // Validate input
  // ---------------------------------------------------------------------------

  if (!token) {
    res.status(400);
    throw new Error("Reset token is required");
  }

  if (!password || !confirmPassword) {
    res.status(400);
    throw new Error("Please provide new password and confirmation");
  }

  if (password !== confirmPassword) {
    res.status(400);
    throw new Error("Passwords do not match");
  }

  if (password.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters long");
  }

  // ---------------------------------------------------------------------------
  // Hash the received token and find user
  // ---------------------------------------------------------------------------
  //
  // We hash the token from URL and compare with stored hash
  // This way, even if database is compromised, tokens can't be used

  const hashedToken = hashResetToken(token);

  const user = await prisma.user.findFirst({
    where: {
      resetPasswordToken: hashedToken,
      resetPasswordExpire: {
        gt: new Date(), // Token must not be expired
      },
    },
  });

  if (!user) {
    res.status(400);
    throw new Error(
      "Invalid or expired reset token. Please request a new one."
    );
  }

  // ---------------------------------------------------------------------------
  // Update password
  // ---------------------------------------------------------------------------

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetPasswordToken: null, // Clear reset token
      resetPasswordExpire: null,
    },
  });

  // ---------------------------------------------------------------------------
  // Generate new login token
  // ---------------------------------------------------------------------------

  const authToken = generateToken(user.id);

  res.status(200).json({
    success: true,
    message:
      "Password reset successful! You can now log in with your new password. (SRS-12)",
    data: { token: authToken },
  });
});

// =============================================================================
// @desc    Logout user (client-side only in JWT)
// @route   POST /api/auth/logout
// @access  Private
// =============================================================================
//
// Note: With JWTs, logout is typically handled client-side by deleting the token.
// This endpoint is for:
// 1. Clearing httpOnly cookies (if used)
// 2. Logging the logout event
// 3. Future: Token blacklisting

const logout = asyncHandler(async (req, res) => {
  // If using cookies, clear them
  res.cookie("token", "", {
    httpOnly: true,
    expires: new Date(0),
  });

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

// =============================================================================
// @desc    Delete own account
// @route   DELETE /api/auth/account
// @access  Private
// =============================================================================
//
// Allows users to delete their own account.
// HARD DELETE - Permanently removes user and ALL related data including orders.
//
const deleteOwnAccount = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // HARD DELETE - Remove everything
  // Delete all related data first to maintain referential integrity
  await prisma.$transaction([
    // Delete order tracking history
    prisma.orderTracking.deleteMany({
      where: { order: { userId } },
    }),
    // Delete order items
    prisma.orderItem.deleteMany({
      where: { order: { userId } },
    }),
    // Delete payments
    prisma.payment.deleteMany({
      where: { order: { userId } },
    }),
    // Delete deliveries
    prisma.delivery.deleteMany({
      where: { order: { userId } },
    }),
    // Delete orders
    prisma.order.deleteMany({
      where: { userId },
    }),
    // Delete reviews
    prisma.review.deleteMany({
      where: { userId },
    }),
    // Delete notifications
    prisma.notification.deleteMany({
      where: { userId },
    }),
    // Delete cart items
    prisma.cartItem.deleteMany({
      where: { cart: { userId } },
    }),
    // Delete cart
    prisma.cart.deleteMany({
      where: { userId },
    }),
    // Finally, delete user
    prisma.user.delete({
      where: { id: userId },
    }),
  ]);

  res.status(200).json({
    success: true,
    message: 'Account and all associated data deleted permanently',
  });
});

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  signup,
  login,
  getMe,
  updateProfile,
  uploadProfilePicture,
  changePassword,
  forgotPassword,
  resetPassword,
  logout,
  deleteOwnAccount,
};

// =============================================================================
// API DOCUMENTATION
// =============================================================================
//
// POST /api/auth/signup
// Body: { name, email, password, phone?, dateOfBirth?, address? }
// Response: { success, message, data: { user, token } }
//
// POST /api/auth/login
// Body: { email, password }
// Response: { success, message, data: { user, token } }
//
// GET /api/auth/me
// Headers: Authorization: Bearer <token>
// Response: { success, data: user }
//
// PUT /api/auth/profile
// Headers: Authorization: Bearer <token>
// Body: { name?, phone?, address?, dateOfBirth?, profileImage? }
// Response: { success, message, data: user }
//
// PUT /api/auth/change-password
// Headers: Authorization: Bearer <token>
// Body: { currentPassword, newPassword, confirmPassword }
// Response: { success, message, data: { token } }
//
// POST /api/auth/forgot-password
// Body: { email }
// Response: { success, message }
//
// POST /api/auth/reset-password/:token
// Body: { password, confirmPassword }
// Response: { success, message, data: { token } }
//
// POST /api/auth/logout
// Headers: Authorization: Bearer <token>
// Response: { success, message }
//
// =============================================================================
