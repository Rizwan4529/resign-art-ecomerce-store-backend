// =============================================================================
// APP.JS - Express Application Configuration
// =============================================================================
//
// This file configures the Express application with all necessary middleware
// and routes. It's separate from server.js to:
// 1. Keep concerns separated (configuration vs. startup)
// 2. Make the app testable (import without starting server)
// 3. Follow industry best practices
//
// EXPRESS MIDDLEWARE EXECUTION ORDER:
// -----------------------------------
// Middleware executes in the ORDER it's registered!
//
// Request → cors → json parser → routes → error handler → Response
//
// =============================================================================

// -----------------------------------------------------------------------------
// IMPORT DEPENDENCIES
// -----------------------------------------------------------------------------

const express = require("express");
// Express is our web framework - handles HTTP requests/responses

const cors = require("cors");
// CORS (Cross-Origin Resource Sharing) allows requests from different domains
// Without this, browsers block requests from frontend to backend if they're
// on different ports (e.g., React on :3000, API on :5000)

// -----------------------------------------------------------------------------
// IMPORT ROUTES
// -----------------------------------------------------------------------------
// Each route file handles a specific resource/module

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/productRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const stockRoutes = require("./routes/stockRoutes");
const reportRoutes = require("./routes/reportRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const salesReportRoutes = require("./routes/salesReportRoutes");
const contactRoutes = require("./routes/contactRoutes");

// -----------------------------------------------------------------------------
// IMPORT MIDDLEWARE
// -----------------------------------------------------------------------------

const { notFound, errorHandler } = require("./middleware/errorMiddleware");

// -----------------------------------------------------------------------------
// CREATE EXPRESS APPLICATION
// -----------------------------------------------------------------------------

const app = express();
// express() returns an Express application instance
// This is the main object we configure and export

// -----------------------------------------------------------------------------
// GLOBAL MIDDLEWARE CONFIGURATION
// -----------------------------------------------------------------------------
//
// Middleware functions have access to:
// - req (request object)
// - res (response object)
// - next (function to call next middleware)
//
// They can:
// - Execute code
// - Modify req/res objects
// - End the request-response cycle
// - Call next middleware

// -------------------------
// 1. CORS Configuration
// -------------------------
// Cross-Origin Resource Sharing
// Allows/restricts which domains can access our API

const corsOptions = {
  // Origin: which domains can access this API
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    // Allowed origins list
    const allowedOrigins = [
      "http://localhost:3000", // React dev server
      "http://localhost:5173", // Vite dev server
      process.env.FRONTEND_URL, // Production frontend
    ].filter(Boolean); // Remove undefined values

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // In development, allow all origins for easier testing
      if (process.env.NODE_ENV === "development") {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    }
  },

  // Credentials: allow cookies and authorization headers
  credentials: true,

  // Methods: which HTTP methods are allowed
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

  // Allowed headers in requests
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
  ],

  // Headers to expose to the browser
  exposedHeaders: ["X-Total-Count", "X-Total-Pages"],

  // How long to cache preflight response (in seconds)
  maxAge: 86400, // 24 hours
};

app.use(cors(corsOptions));

// -------------------------
// 2. Body Parsing
// -------------------------
// Parse incoming request bodies

// Parse JSON bodies
// This is needed to read req.body when Content-Type is application/json
app.use(
  express.json({
    limit: "10mb", // Limit body size to prevent DoS attacks
  }),
);

// Parse URL-encoded bodies (form submissions)
// extended: true allows nested objects in form data
app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  }),
);

// -------------------------
// 2.5. Static File Serving
// -------------------------
// Serve uploaded files (product images, etc.)
const path = require("path");
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// -------------------------
// 3. Request Logging (Development)
// -------------------------
// Log every request in development for debugging

if (process.env.NODE_ENV === "development") {
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);

    // Log request body for POST/PUT/PATCH (useful for debugging)
    if (
      ["POST", "PUT", "PATCH"].includes(req.method) &&
      Object.keys(req.body).length > 0
    ) {
      // Don't log passwords!
      const sanitizedBody = { ...req.body };
      if (sanitizedBody.password) sanitizedBody.password = "[HIDDEN]";
      console.log("   Body:", JSON.stringify(sanitizedBody).substring(0, 200));
    }

    next();
  });
}

// -------------------------
// 4. Security Headers
// -------------------------
// Add basic security headers to all responses

app.use((req, res, next) => {
  // Prevent clickjacking attacks
  res.setHeader("X-Frame-Options", "DENY");

  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Enable XSS filter in browsers
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Remove X-Powered-By header (hides that we're using Express)
  res.removeHeader("X-Powered-By");

  next();
});

// -----------------------------------------------------------------------------
// HEALTH CHECK ENDPOINT
// -----------------------------------------------------------------------------
//
// Used by load balancers, monitoring tools, and deployment platforms
// to check if the server is running and healthy

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// -----------------------------------------------------------------------------
// API INFORMATION ENDPOINT
// -----------------------------------------------------------------------------
//
// Provides information about the API (version, documentation, etc.)

app.get("/api", (req, res) => {
  res.json({
    name: "Resin Art E-Commerce API",
    version: "1.0.0",
    description: "Backend API for E-Commerce Website for Resin Art",
    documentation: "/api/docs",
    endpoints: {
      auth: "/api/auth",
      users: "/api/users",
      products: "/api/products",
      cart: "/api/cart",
      orders: "/api/orders",
      payments: "/api/payments",
      reviews: "/api/reviews",
      stock: "/api/stock",
      inventory: "/api/inventory",
      reports: "/api/reports",
      salesReports: "/api/reports/sales",
      notifications: "/api/notifications",
      contact: "/api/contact",
    },
  });
});

// -----------------------------------------------------------------------------
// API ROUTES
// -----------------------------------------------------------------------------
//
// Each route file handles a specific resource.
// The first argument is the base path - all routes in the file are relative to it.
//
// Example: If authRoutes has a '/login' route, the full path is '/api/auth/login'

// Section 5.1: Security Management (Signup, Login, Password)
app.use("/api/auth", authRoutes);

// Section 5.3: User Management (Block, Unblock, Profiles)
app.use("/api/users", userRoutes);

// Section 5.2: Product Management (CRUD operations)
app.use("/api/products", productRoutes);

// Section 5.4: Cart Management (Add, View, Remove)
app.use("/api/cart", cartRoutes);

// Section 5.5: Order Management (Confirm, Process, Cancel)
app.use("/api/orders", orderRoutes);

// Section 5.6: Payment Management
app.use("/api/payments", paymentRoutes);

// Section 5.10: Review Management (Feedback, Rating)
app.use("/api/reviews", reviewRoutes);

// Section 5.9: Stock Management
app.use("/api/stock", stockRoutes);

// Section 5.9: Inventory Management (with history tracking)
app.use("/api/inventory", inventoryRoutes);

// Section 5.13 & 5.14: Profit & Expense Reports
app.use("/api/reports", reportRoutes);

// Sales Reports (PDF generation)
app.use("/api/reports/sales", salesReportRoutes);

// Section 5.12: Notifications
app.use("/api/notifications", notificationRoutes);

// Contact Form Submissions
app.use("/api/contact", contactRoutes);

// -----------------------------------------------------------------------------
// ERROR HANDLING MIDDLEWARE
// -----------------------------------------------------------------------------
//
// These MUST be registered AFTER all routes!
// They catch errors from routes and return appropriate responses.

// Handle 404 - Route not found
// This catches any request that didn't match a route above
app.use(notFound);

// Handle all other errors
// This catches errors thrown in route handlers
app.use(errorHandler);

// -----------------------------------------------------------------------------
// EXPORT APPLICATION
// -----------------------------------------------------------------------------

module.exports = app;

// =============================================================================
// MIDDLEWARE ORDER SUMMARY
// =============================================================================
//
// 1. CORS - Allow cross-origin requests
// 2. Body Parser - Parse JSON and form data
// 3. Logging - Log requests (dev only)
// 4. Security Headers - Add protective headers
// 5. Routes - Handle API requests
// 6. 404 Handler - Catch unmatched routes
// 7. Error Handler - Catch and format errors
//
// =============================================================================
