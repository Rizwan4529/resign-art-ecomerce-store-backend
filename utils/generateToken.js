// =============================================================================
// JWT TOKEN GENERATION UTILITY
// =============================================================================
// 
// This utility handles JWT (JSON Web Token) generation for authentication.
// JWTs are used to securely transmit information between client and server.
//
// JWT COMPONENTS:
// ---------------
// 1. Header - Contains token type and signing algorithm
//    {"alg": "HS256", "typ": "JWT"}
//
// 2. Payload - Contains claims (data)
//    {"userId": 1, "iat": 1234567890, "exp": 1234567890}
//
// 3. Signature - Verifies token hasn't been tampered with
//    HMACSHA256(base64(header) + "." + base64(payload), secret)
//
// TOKEN FLOW:
// -----------
// 1. User logs in with credentials
// 2. Server verifies credentials
// 3. Server creates JWT with user ID
// 4. Client stores JWT (localStorage, cookie, etc.)
// 5. Client sends JWT in Authorization header
// 6. Server verifies JWT on protected routes
//
// =============================================================================

const jwt = require('jsonwebtoken');
// jsonwebtoken is the most popular JWT library for Node.js

const crypto = require('crypto');
// Node.js built-in module for cryptographic operations

// =============================================================================
// GENERATE ACCESS TOKEN
// =============================================================================
// 
// Creates a JWT token for authenticated sessions.
// Used for API authentication - sent in Authorization header.

/**
 * Generate JWT access token for a user
 * @param {number} userId - The user's ID to encode in the token
 * @returns {string} JWT token string
 */
const generateToken = (userId) => {
  // -------------------------------------------------------------------------
  // VALIDATE INPUT
  // -------------------------------------------------------------------------
  
  if (!userId) {
    throw new Error('User ID is required to generate token');
  }
  
  // -------------------------------------------------------------------------
  // CREATE TOKEN
  // -------------------------------------------------------------------------
  // 
  // jwt.sign(payload, secret, options)
  // - payload: Data to encode (keep it minimal for security)
  // - secret: Key used to sign the token (must be kept secret!)
  // - options: Configuration like expiration time
  
  const token = jwt.sign(
    // Payload - Keep it minimal!
    // Don't include sensitive data like password, email, etc.
    // Anyone can decode the payload (it's just base64)
    // The signature only prevents tampering, not reading
    { 
      userId: userId,
      // Optionally add token type for multiple token types
      type: 'access'
    },
    
    // Secret key from environment variable
    // NEVER hardcode this! Use environment variables
    process.env.JWT_SECRET,
    
    // Options
    {
      // expiresIn: When the token expires
      // Formats: '30d' (days), '24h' (hours), '60m' (minutes), '120s' (seconds)
      // Or number of seconds: 86400 (24 hours)
      expiresIn: process.env.JWT_EXPIRE || '30d',
      
      // algorithm: Signing algorithm (default is HS256)
      // HS256 = HMAC with SHA-256 (symmetric)
      // RS256 = RSA with SHA-256 (asymmetric) - more secure for distributed systems
      algorithm: 'HS256',
      
      // issuer: Who created this token (optional but useful)
      issuer: 'resin-art-api',
      
      // audience: Who this token is for (optional)
      audience: 'resin-art-client',
    }
  );
  
  return token;
};

// =============================================================================
// GENERATE REFRESH TOKEN
// =============================================================================
// 
// Refresh tokens are used to get new access tokens without re-authenticating.
// They have longer expiration and are stored securely (httpOnly cookie).
//
// WHY REFRESH TOKENS?
// -------------------
// - Access tokens are short-lived (15 min to 1 hour) for security
// - If access token expires, user would need to log in again
// - Refresh token allows getting new access token without credentials
// - If refresh token is stolen, it can be revoked without changing password

/**
 * Generate a refresh token
 * @param {number} userId - The user's ID
 * @returns {string} Refresh token string
 */
const generateRefreshToken = (userId) => {
  if (!userId) {
    throw new Error('User ID is required to generate refresh token');
  }
  
  const refreshToken = jwt.sign(
    { 
      userId: userId,
      type: 'refresh'
    },
    // Use a different secret for refresh tokens (more secure)
    // Or use the same with a prefix
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh',
    {
      // Refresh tokens last much longer
      expiresIn: '7d', // 7 days
      algorithm: 'HS256',
      issuer: 'resin-art-api',
    }
  );
  
  return refreshToken;
};

// =============================================================================
// GENERATE PASSWORD RESET TOKEN
// =============================================================================
// 
// Creates a random token for password reset functionality.
// This is NOT a JWT - it's a random string stored in database.
//
// RESET FLOW:
// 1. User requests password reset with email
// 2. Server generates random token
// 3. Server hashes token and stores hash in database
// 4. Server sends unhashed token to user's email
// 5. User clicks link with token
// 6. Server hashes received token and compares with stored hash
// 7. If match and not expired, allow password reset

/**
 * Generate a password reset token
 * @returns {Object} Object containing token and hashed token
 */
const generateResetToken = () => {
  // -------------------------------------------------------------------------
  // Generate Random Token
  // -------------------------------------------------------------------------
  // crypto.randomBytes generates cryptographically secure random data
  // 32 bytes = 256 bits of randomness
  // toString('hex') converts to hexadecimal string (64 characters)
  
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  // -------------------------------------------------------------------------
  // Hash the Token for Storage
  // -------------------------------------------------------------------------
  // We store the HASH in database, not the token itself
  // This way, even if database is compromised, attacker can't use tokens
  //
  // createHash('sha256'): Use SHA-256 algorithm
  // update(resetToken): Add data to hash
  // digest('hex'): Output as hexadecimal string
  
  const hashedToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  return {
    resetToken,      // Send this to user (in email link)
    hashedToken,     // Store this in database
  };
};

// =============================================================================
// VERIFY RESET TOKEN
// =============================================================================
// 
// When user submits reset token, verify it matches stored hash.

/**
 * Hash a reset token for comparison
 * @param {string} token - The token to hash
 * @returns {string} Hashed token
 */
const hashResetToken = (token) => {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
};

// =============================================================================
// GENERATE EMAIL VERIFICATION TOKEN
// =============================================================================
// 
// Creates a token for email verification functionality.
// Similar to password reset token.

/**
 * Generate an email verification token
 * @returns {Object} Object containing token and hashed token
 */
const generateVerificationToken = () => {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  
  const hashedToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  
  return {
    verificationToken,
    hashedToken,
  };
};

// =============================================================================
// DECODE TOKEN (Without Verification)
// =============================================================================
// 
// Decodes a JWT without verifying the signature.
// Useful for debugging or when you just need to read the payload.
// WARNING: Don't trust the data - it could be tampered with!

/**
 * Decode a JWT without verification
 * @param {string} token - JWT to decode
 * @returns {Object|null} Decoded payload or null if invalid format
 */
const decodeToken = (token) => {
  try {
    // jwt.decode doesn't verify signature, just decodes
    return jwt.decode(token, { complete: true });
    // Returns: { header, payload, signature }
  } catch (error) {
    return null;
  }
};

// =============================================================================
// CHECK TOKEN EXPIRATION
// =============================================================================
// 
// Check if a token is expired without throwing an error.

/**
 * Check if a token is expired
 * @param {string} token - JWT to check
 * @returns {boolean} True if expired or invalid, false if valid
 */
const isTokenExpired = (token) => {
  try {
    const decoded = jwt.decode(token);
    
    if (!decoded || !decoded.exp) {
      return true;
    }
    
    // exp is in seconds, Date.now() is in milliseconds
    return decoded.exp * 1000 < Date.now();
  } catch (error) {
    return true;
  }
};

// =============================================================================
// GENERATE OTP (One-Time Password)
// =============================================================================
// 
// Generates a numeric OTP for verification (SMS, email, etc.)
// Used for two-factor authentication or phone verification.

/**
 * Generate a numeric OTP
 * @param {number} length - Length of OTP (default: 6)
 * @returns {string} OTP string
 */
const generateOTP = (length = 6) => {
  // Generate random bytes
  const bytes = crypto.randomBytes(length);
  
  // Convert to number and take required digits
  let otp = '';
  for (let i = 0; i < length; i++) {
    // Each byte is 0-255, we want 0-9
    otp += (bytes[i] % 10).toString();
  }
  
  return otp;
};

// =============================================================================
// TOKEN CONFIGURATION HELPER
// =============================================================================
// 
// Get token configuration for different use cases.

/**
 * Get token configuration
 * @returns {Object} Token configuration object
 */
const getTokenConfig = () => {
  return {
    accessToken: {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRE || '30d',
    },
    refreshToken: {
      secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh',
      expiresIn: '7d',
    },
    resetToken: {
      expiresIn: 10 * 60 * 1000, // 10 minutes in milliseconds
    },
    verificationToken: {
      expiresIn: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    },
    otp: {
      length: 6,
      expiresIn: 5 * 60 * 1000, // 5 minutes in milliseconds
    },
  };
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  generateToken,          // Main JWT for authentication
  generateRefreshToken,   // Refresh token for getting new access tokens
  generateResetToken,     // Password reset token
  hashResetToken,         // Hash token for comparison
  generateVerificationToken, // Email verification token
  decodeToken,            // Decode without verification
  isTokenExpired,         // Check if token is expired
  generateOTP,            // Generate numeric OTP
  getTokenConfig,         // Get token configuration
};

// =============================================================================
// USAGE EXAMPLES
// =============================================================================
// 
// // Generate JWT on login
// const token = generateToken(user.id);
// res.json({ success: true, token });
// 
// // Generate password reset token
// const { resetToken, hashedToken } = generateResetToken();
// await prisma.user.update({
//   where: { id: user.id },
//   data: {
//     resetPasswordToken: hashedToken,
//     resetPasswordExpire: new Date(Date.now() + 10 * 60 * 1000), // 10 min
//   }
// });
// // Send resetToken in email link: /reset-password?token=${resetToken}
// 
// // Verify reset token
// const hashedToken = hashResetToken(req.query.token);
// const user = await prisma.user.findFirst({
//   where: {
//     resetPasswordToken: hashedToken,
//     resetPasswordExpire: { gt: new Date() }
//   }
// });
//
// =============================================================================
