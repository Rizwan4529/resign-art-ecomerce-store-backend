// =============================================================================
// ERROR MIDDLEWARE - Centralized Error Handling
// =============================================================================
// 
// This middleware provides centralized error handling for the entire application.
// Instead of handling errors in every route, we throw errors and catch them here.
//
// BENEFITS OF CENTRALIZED ERROR HANDLING:
// 1. Consistent error response format across all routes
// 2. Single place to log errors
// 3. Different error handling for development vs production
// 4. Cleaner route handlers (just throw errors)
//
// HOW EXPRESS ERROR HANDLING WORKS:
// ---------------------------------
// - Regular middleware: (req, res, next)
// - Error middleware: (error, req, res, next) - 4 parameters!
// - Express knows it's error middleware by the 4 parameters
// - Must be registered AFTER all routes
//
// =============================================================================

// =============================================================================
// NOT FOUND MIDDLEWARE - 404 Handler
// =============================================================================
// 
// This catches any request that didn't match a route.
// It creates a 404 error and passes it to the error handler.
//
// MUST be placed AFTER all routes but BEFORE error handler.

const notFound = (req, res, next) => {
  // Create a new Error with a descriptive message
  const error = new Error(`Not Found - ${req.method} ${req.originalUrl}`);
  
  // Set status code to 404
  res.status(404);
  
  // Pass error to the error handler middleware
  next(error);
};

// =============================================================================
// ERROR HANDLER MIDDLEWARE - Main Error Handler
// =============================================================================
// 
// This catches ALL errors in the application:
// - Errors thrown in route handlers
// - Errors from async functions (if using asyncHandler)
// - Prisma/database errors
// - Validation errors
// - JWT errors
//
// NOTE: 4 parameters tells Express this is error-handling middleware

const errorHandler = (err, req, res, next) => {
  // -------------------------------------------------------------------------
  // STEP 1: Determine Status Code
  // -------------------------------------------------------------------------
  // 
  // If res.statusCode is still 200 (default), change to 500
  // Otherwise, use whatever code was set before the error
  
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
  // -------------------------------------------------------------------------
  // STEP 2: Get Error Message
  // -------------------------------------------------------------------------
  
  let message = err.message || 'Internal Server Error';
  
  // -------------------------------------------------------------------------
  // STEP 3: Handle Specific Error Types
  // -------------------------------------------------------------------------
  // 
  // Different types of errors need different handling.
  // We identify them by name, code, or other properties.
  
  // =====================
  // PRISMA ERRORS
  // =====================
  // Prisma throws specific error codes for different scenarios
  // See: https://www.prisma.io/docs/reference/api-reference/error-reference
  
  // P2002: Unique constraint violation (duplicate entry)
  if (err.code === 'P2002') {
    statusCode = 400;
    // err.meta.target contains the field(s) that violated uniqueness
    const field = err.meta?.target?.[0] || 'field';
    message = `A record with this ${field} already exists.`;
  }
  
  // P2025: Record not found
  if (err.code === 'P2025') {
    statusCode = 404;
    message = 'Record not found.';
  }
  
  // P2003: Foreign key constraint failed
  if (err.code === 'P2003') {
    statusCode = 400;
    const field = err.meta?.field_name || 'reference';
    message = `Invalid ${field}. The referenced record does not exist.`;
  }
  
  // P2014: Required relation violation
  if (err.code === 'P2014') {
    statusCode = 400;
    message = 'The operation would violate a required relation.';
  }
  
  // P2021: Table does not exist
  if (err.code === 'P2021') {
    statusCode = 500;
    message = 'Database table not found. Please run migrations.';
  }
  
  // P2024: Timed out waiting for connection from pool
  if (err.code === 'P2024') {
    statusCode = 503;
    message = 'Database connection timeout. Please try again.';
  }
  
  // =====================
  // VALIDATION ERRORS (express-validator)
  // =====================
  
  if (err.name === 'ValidationError' || err.array) {
    statusCode = 400;
    // If it's express-validator errors
    if (typeof err.array === 'function') {
      const errors = err.array();
      message = errors.map(e => e.msg).join(', ');
    }
  }
  
  // =====================
  // JWT ERRORS
  // =====================
  
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token. Please log in again.';
  }
  
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired. Please log in again.';
  }
  
  // =====================
  // SYNTAX ERRORS (Invalid JSON in request body)
  // =====================
  
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Invalid JSON in request body.';
  }
  
  // =====================
  // TYPE ERROR (Common programming errors)
  // =====================
  
  if (err.name === 'TypeError') {
    statusCode = 500;
    // In production, don't expose internal errors
    if (process.env.NODE_ENV === 'production') {
      message = 'An internal error occurred.';
    }
  }
  
  // =====================
  // MULTER ERRORS (File upload errors)
  // =====================
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    message = 'File too large. Maximum size is 5MB.';
  }
  
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    message = 'Unexpected file field.';
  }
  
  // -------------------------------------------------------------------------
  // STEP 4: Log Error (Development)
  // -------------------------------------------------------------------------
  
  if (process.env.NODE_ENV === 'development') {
    console.error('\n❌ Error:');
    console.error('   Message:', message);
    console.error('   Status:', statusCode);
    console.error('   Code:', err.code);
    console.error('   Stack:', err.stack?.split('\n').slice(0, 5).join('\n'));
    console.error('');
  } else {
    // In production, log to error tracking service
    // Example: Sentry, LogRocket, etc.
    // Sentry.captureException(err);
    
    // Minimal console logging in production
    console.error(`[ERROR] ${statusCode} - ${message} - ${req.method} ${req.originalUrl}`);
  }
  
  // -------------------------------------------------------------------------
  // STEP 5: Send Error Response
  // -------------------------------------------------------------------------
  
  const errorResponse = {
    success: false,
    message,
    // Include error code for client-side error handling
    code: err.code || null,
  };
  
  // Include stack trace in development only
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.name = err.name;
    // Include Prisma meta information in development
    if (err.meta) {
      errorResponse.meta = err.meta;
    }
  }
  
  res.status(statusCode).json(errorResponse);
};

// =============================================================================
// ASYNC HANDLER - Wrapper for Async Route Handlers
// =============================================================================
// 
// Express doesn't catch errors from async functions automatically.
// This wrapper catches them and passes to error middleware.
//
// WITHOUT asyncHandler:
// router.get('/users', async (req, res, next) => {
//   try {
//     const users = await getUsers();
//     res.json(users);
//   } catch (error) {
//     next(error); // Must manually call next(error)
//   }
// });
//
// WITH asyncHandler:
// router.get('/users', asyncHandler(async (req, res) => {
//   const users = await getUsers();
//   res.json(users); // If this throws, it's caught automatically
// }));

/**
 * Wraps an async function to catch errors and pass to error middleware
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped function that catches errors
 */
const asyncHandler = (fn) => (req, res, next) => {
  // Execute the function and catch any errors
  Promise.resolve(fn(req, res, next)).catch(next);
  // If fn throws or returns rejected promise, catch() passes error to next()
  // next(error) triggers error handling middleware
};

// =============================================================================
// CUSTOM ERROR CLASS
// =============================================================================
// 
// A custom error class that includes status code.
// Makes it easy to throw errors with specific status codes.
//
// Usage:
// throw new AppError('User not found', 404);

class AppError extends Error {
  /**
   * Create a custom application error
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   */
  constructor(message, statusCode) {
    super(message);
    
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // Distinguishes from programming errors
    
    // Capture stack trace, excluding constructor call from stack
    Error.captureStackTrace(this, this.constructor);
  }
}

// =============================================================================
// ERROR CODES REFERENCE
// =============================================================================
// 
// Common HTTP Status Codes for APIs:
//
// 2xx SUCCESS:
// 200 OK - Request succeeded
// 201 Created - Resource created successfully
// 204 No Content - Success but no response body (DELETE)
//
// 4xx CLIENT ERRORS:
// 400 Bad Request - Invalid request data
// 401 Unauthorized - Not authenticated
// 403 Forbidden - Authenticated but not authorized
// 404 Not Found - Resource doesn't exist
// 409 Conflict - Resource conflict (e.g., duplicate)
// 422 Unprocessable Entity - Validation failed
// 429 Too Many Requests - Rate limit exceeded
//
// 5xx SERVER ERRORS:
// 500 Internal Server Error - Generic server error
// 502 Bad Gateway - Invalid response from upstream
// 503 Service Unavailable - Server overloaded/down
// 504 Gateway Timeout - Upstream timeout
//
// =============================================================================

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  notFound,
  errorHandler,
  asyncHandler,
  AppError,
};

// =============================================================================
// USAGE EXAMPLES
// =============================================================================
// 
// // In routes:
// const { asyncHandler, AppError } = require('../middleware/errorMiddleware');
// 
// // Wrap async handlers
// router.get('/products', asyncHandler(async (req, res) => {
//   const products = await prisma.product.findMany();
//   res.json({ success: true, data: products });
// }));
// 
// // Throw custom errors
// router.get('/products/:id', asyncHandler(async (req, res) => {
//   const product = await prisma.product.findUnique({ where: { id: parseInt(req.params.id) } });
//   
//   if (!product) {
//     throw new AppError('Product not found', 404);
//   }
//   
//   res.json({ success: true, data: product });
// }));
//
// =============================================================================
