// =============================================================================
// AUTH MIDDLEWARE - JWT Authentication & Authorization
// =============================================================================
// 
// This middleware handles:
// 1. Authentication: Verifying that a user is logged in (has valid JWT)
// 2. Authorization: Verifying that a user has permission to access a resource
//
// Based on Section 5.1 (Security Management) and Section 3.1 (Security Requirements)
//
// HOW JWT AUTHENTICATION WORKS:
// -----------------------------
// 1. User logs in with email/password
// 2. Server verifies credentials and creates a JWT token
// 3. Server sends token to client
// 4. Client stores token (usually in localStorage or httpOnly cookie)
// 5. Client sends token in Authorization header with each request
// 6. Server verifies token and identifies user
//
// JWT TOKEN STRUCTURE:
// --------------------
// A JWT has three parts separated by dots: header.payload.signature
// 
// Header: {"alg": "HS256", "typ": "JWT"}
// Payload: {"userId": 1, "iat": 1234567890, "exp": 1234567890}
// Signature: HMACSHA256(base64(header) + "." + base64(payload), secret)
//
// =============================================================================

const jwt = require('jsonwebtoken');
// jsonwebtoken library handles JWT creation and verification

const { prisma } = require('../config/db');
// Prisma client for database queries

// =============================================================================
// PROTECT MIDDLEWARE - Verify User is Logged In
// =============================================================================
// 
// This middleware:
// 1. Extracts JWT from Authorization header
// 2. Verifies the token is valid and not expired
// 3. Finds the user in database
// 4. Attaches user to req object for use in route handlers
//
// Usage: router.get('/profile', protect, getProfile)

const protect = async (req, res, next) => {
  try {
    // -------------------------------------------------------------------------
    // STEP 1: Extract Token from Authorization Header
    // -------------------------------------------------------------------------
    // 
    // The Authorization header format is: "Bearer <token>"
    // Example: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    //
    // Why "Bearer"?
    // - It's the standard scheme for OAuth 2.0 / JWT authentication
    // - Other schemes exist: Basic, Digest, etc.
    
    let token;
    
    // Check if Authorization header exists and starts with 'Bearer'
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      // Extract the token part (after 'Bearer ')
      token = req.headers.authorization.split(' ')[1];
      // ['Bearer', 'eyJhbG...'][1] = 'eyJhbG...'
    }
    
    // Also check for token in cookies (alternative method)
    // Some apps send tokens in httpOnly cookies for better security
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    
    // If no token found, user is not authenticated
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route. Please log in.',
        // 401 Unauthorized: No valid authentication credentials
      });
    }
    
    // -------------------------------------------------------------------------
    // STEP 2: Verify Token
    // -------------------------------------------------------------------------
    // 
    // jwt.verify() does several things:
    // 1. Decodes the token
    // 2. Verifies the signature using our secret
    // 3. Checks if token is expired
    // 4. Returns the payload if valid, throws error if not
    
    let decoded;
    
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      // decoded = { userId: 1, iat: 1234567890, exp: 1234567890 }
      
    } catch (jwtError) {
      // Handle specific JWT errors
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired. Please log in again.',
          expiredAt: jwtError.expiredAt,
        });
      }
      
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token. Please log in again.',
        });
      }
      
      // Other JWT errors
      return res.status(401).json({
        success: false,
        message: 'Token verification failed.',
      });
    }
    
    // -------------------------------------------------------------------------
    // STEP 3: Find User in Database
    // -------------------------------------------------------------------------
    // 
    // Even with a valid token, we need to verify:
    // 1. User still exists (might have been deleted)
    // 2. User is still active (not blocked)
    // 3. Password hasn't changed since token was issued
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        // Select only fields we need (not password!)
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        profileImage: true,
        createdAt: true,
      },
    });
    
    // Check if user exists
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists.',
      });
    }
    
    // Check if user is blocked (Section 5.3.1)
    if (user.status === 'BLOCKED') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked. Please contact support.',
        // 403 Forbidden: User exists but doesn't have permission
      });
    }
    
    // Check if user is inactive
    if (user.status === 'INACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Your account is inactive. Please reactivate it.',
      });
    }
    
    // -------------------------------------------------------------------------
    // STEP 4: Attach User to Request Object
    // -------------------------------------------------------------------------
    // 
    // By attaching the user to req, subsequent middleware and route handlers
    // can access the authenticated user without querying the database again.
    
    req.user = user;
    // Now route handlers can use req.user.id, req.user.role, etc.
    
    // Move to next middleware/route handler
    next();
    
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error. Please try again.',
    });
  }
};

// =============================================================================
// AUTHORIZE MIDDLEWARE - Role-Based Access Control
// =============================================================================
// 
// This middleware restricts routes to specific user roles.
// It MUST be used AFTER the protect middleware.
//
// Usage: router.delete('/product/:id', protect, authorize('ADMIN'), deleteProduct)
//
// How it works:
// 1. authorize() is a higher-order function that returns middleware
// 2. The returned middleware checks if req.user.role is in allowed roles
// 3. If not, returns 403 Forbidden

/**
 * Authorize access based on user roles
 * @param {...string} roles - Allowed roles (e.g., 'ADMIN', 'USER')
 * @returns {Function} Express middleware function
 */
const authorize = (...roles) => {
  // This function returns the actual middleware
  return (req, res, next) => {
    // Check if protect middleware was run first
    if (!req.user) {
      return res.status(500).json({
        success: false,
        message: 'Authorization check failed. Please authenticate first.',
      });
    }
    
    // Check if user's role is in the allowed roles
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route.`,
        requiredRoles: roles,
      });
    }
    
    // User has required role, continue
    next();
  };
};

// =============================================================================
// OPTIONAL AUTH MIDDLEWARE - Check Auth Without Requiring It
// =============================================================================
// 
// Sometimes we want to know if a user is logged in, but still allow
// access if they're not. For example:
// - Product pages might show different UI for logged-in users
// - Reviews might show if the current user wrote them
//
// Usage: router.get('/products', optionalAuth, getProducts)

const optionalAuth = async (req, res, next) => {
  try {
    let token;
    
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      // No token, but that's okay - continue without user
      req.user = null;
      return next();
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
        },
      });
      
      // Only set user if they exist and are active
      if (user && user.status === 'ACTIVE') {
        req.user = user;
      } else {
        req.user = null;
      }
      
    } catch (jwtError) {
      // Invalid token, but that's okay - continue without user
      req.user = null;
    }
    
    next();
    
  } catch (error) {
    // Any error, continue without user
    req.user = null;
    next();
  }
};

// =============================================================================
// ADMIN ONLY MIDDLEWARE - Shortcut for Admin Authorization
// =============================================================================
// 
// A convenience middleware that combines protect + authorize('ADMIN')
// 
// Usage: router.get('/admin-only', adminOnly, adminRoute)

const adminOnly = [protect, authorize('ADMIN')];
// This is an array of middleware that will be executed in order

// =============================================================================
// VERIFY OWNERSHIP MIDDLEWARE FACTORY
// =============================================================================
// 
// Creates middleware that verifies a user owns a resource.
// Useful for routes where users can only modify their own data.
//
// Usage:
// router.put('/reviews/:id', protect, verifyOwnership('review'), updateReview)

/**
 * Create middleware to verify resource ownership
 * @param {string} resourceType - Type of resource ('review', 'order', etc.)
 * @returns {Function} Express middleware function
 */
const verifyOwnership = (resourceType) => {
  return async (req, res, next) => {
    try {
      const resourceId = parseInt(req.params.id);
      
      if (isNaN(resourceId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid resource ID.',
        });
      }
      
      let resource;
      
      // Check ownership based on resource type
      switch (resourceType) {
        case 'review':
          resource = await prisma.review.findUnique({
            where: { id: resourceId },
            select: { userId: true },
          });
          break;
          
        case 'order':
          resource = await prisma.order.findUnique({
            where: { id: resourceId },
            select: { userId: true },
          });
          break;
          
        case 'cart':
          resource = await prisma.cart.findUnique({
            where: { id: resourceId },
            select: { userId: true },
          });
          break;
          
        default:
          return res.status(500).json({
            success: false,
            message: `Unknown resource type: ${resourceType}`,
          });
      }
      
      if (!resource) {
        return res.status(404).json({
          success: false,
          message: `${resourceType} not found.`,
        });
      }
      
      // Check if current user owns this resource
      // Admins can access any resource
      if (resource.userId !== req.user.id && req.user.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: `You don't have permission to modify this ${resourceType}.`,
        });
      }
      
      next();
      
    } catch (error) {
      console.error('Ownership verification error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error verifying resource ownership.',
      });
    }
  };
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  protect,          // Verify user is authenticated
  authorize,        // Verify user has required role
  optionalAuth,     // Check auth without requiring it
  adminOnly,        // Shortcut for admin-only routes
  verifyOwnership,  // Verify user owns a resource
};

// =============================================================================
// USAGE EXAMPLES
// =============================================================================
// 
// // Public route - no auth needed
// router.get('/products', getProducts);
// 
// // Protected route - must be logged in
// router.get('/profile', protect, getProfile);
// 
// // Admin only route
// router.delete('/users/:id', protect, authorize('ADMIN'), deleteUser);
// // OR using shortcut:
// router.delete('/users/:id', adminOnly, deleteUser);
// 
// // User can only modify their own review
// router.put('/reviews/:id', protect, verifyOwnership('review'), updateReview);
// 
// // Optional auth - works for both logged in and anonymous users
// router.get('/products/:id', optionalAuth, getProduct);
//
// =============================================================================
