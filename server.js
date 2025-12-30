// =============================================================================
// SERVER.JS - Application Entry Point
// =============================================================================
// 
// This is the main entry point for our Node.js application.
// It's responsible for:
// 1. Loading environment variables
// 2. Connecting to the database
// 3. Starting the HTTP server
//
// WHY SEPARATE server.js FROM app.js?
// -----------------------------------
// Separation of concerns:
// - server.js: Server startup logic (ports, database connection)
// - app.js: Express application configuration (routes, middleware)
//
// Benefits:
// 1. Testing: You can import app.js without starting a server
// 2. Clarity: Each file has a single responsibility
// 3. Flexibility: Easy to add WebSocket server or other protocols
//
// =============================================================================

// -----------------------------------------------------------------------------
// STEP 1: LOAD ENVIRONMENT VARIABLES
// -----------------------------------------------------------------------------
// 
// dotenv loads variables from .env file into process.env
// This MUST be done before importing other modules that might use env vars!
// 
// Why at the top?
// - Modules imported below might read process.env
// - If dotenv isn't loaded first, those values will be undefined

require('dotenv').config();
// After this line, process.env.DATABASE_URL, process.env.PORT, etc. are available

// Verify critical environment variables exist
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('💡 Copy .env.example to .env and fill in the values');
  process.exit(1);
}

// -----------------------------------------------------------------------------
// STEP 2: IMPORT DEPENDENCIES
// -----------------------------------------------------------------------------

// Import our Express application (configured in app.js)
const app = require('./app');

// Import database connection function
const { connectDB } = require('./config/db');

// -----------------------------------------------------------------------------
// STEP 3: CONFIGURATION
// -----------------------------------------------------------------------------

// Port to run the server on
// process.env.PORT allows cloud platforms to set their own port
// 5000 is the fallback for local development
const PORT = process.env.PORT || 5000;

// Node environment
const NODE_ENV = process.env.NODE_ENV || 'development';

// -----------------------------------------------------------------------------
// STEP 4: DATABASE CONNECTION & SERVER STARTUP
// -----------------------------------------------------------------------------
// 
// We use an async IIFE (Immediately Invoked Function Expression) to use await
// at the top level. This pattern is common before ES2022's top-level await.

(async () => {
  try {
    // -------------------------------------------------------------------------
    // Connect to Database
    // -------------------------------------------------------------------------
    // This must succeed before we start accepting requests
    // If database is unavailable, there's no point running the server
    
    console.log('🚀 Starting E-Commerce Backend for Resin Art...\n');
    console.log('📦 Connecting to MySQL database...');
    
    await connectDB();
    
    // -------------------------------------------------------------------------
    // Start HTTP Server
    // -------------------------------------------------------------------------
    
    const server = app.listen(PORT, () => {
      console.log('\n========================================');
      console.log('🎨 Resin Art Backend Server Started!');
      console.log('========================================');
      console.log(`🌍 Environment: ${NODE_ENV}`);
      console.log(`🚀 Server running on: http://localhost:${PORT}`);
      console.log(`📚 API Base URL: http://localhost:${PORT}/api`);
      console.log('========================================\n');
      
      // Log available routes in development
      if (NODE_ENV === 'development') {
        console.log('📌 Available API Routes:');
        console.log('   Auth:     /api/auth');
        console.log('   Users:    /api/users');
        console.log('   Products: /api/products');
        console.log('   Cart:     /api/cart');
        console.log('   Orders:   /api/orders');
        console.log('   Payments: /api/payments');
        console.log('   Reviews:  /api/reviews');
        console.log('   Stock:    /api/stock');
        console.log('   Reports:  /api/reports');
        console.log('\n💡 Prisma Studio: npx prisma studio\n');
      }
    });
    
    // -------------------------------------------------------------------------
    // Graceful Shutdown Handling
    // -------------------------------------------------------------------------
    // 
    // When the server receives a termination signal, we want to:
    // 1. Stop accepting new connections
    // 2. Wait for existing requests to complete
    // 3. Close database connections
    // 4. Exit cleanly
    //
    // This prevents data corruption and ensures a clean shutdown.
    
    // Handle unhandled promise rejections
    // In Node.js, unhandled promise rejections don't crash the process by default
    // But they indicate a bug that should be fixed
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Promise Rejection:', reason);
      // In production, you might want to:
      // 1. Log to error tracking service (Sentry, etc.)
      // 2. Gracefully shut down
      // server.close(() => process.exit(1));
    });
    
    // Handle SIGTERM (sent by process managers like PM2, Docker, Kubernetes)
    process.on('SIGTERM', () => {
      console.log('\n📴 SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        console.log('✅ HTTP server closed');
        // Database disconnect is handled in db.js
        process.exit(0);
      });
    });
    
    // Handle SIGINT (Ctrl+C in terminal)
    process.on('SIGINT', () => {
      console.log('\n📴 SIGINT received. Shutting down gracefully...');
      server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
      });
    });
    
  } catch (error) {
    // -------------------------------------------------------------------------
    // Handle Startup Errors
    // -------------------------------------------------------------------------
    console.error('❌ Failed to start server:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();

// -----------------------------------------------------------------------------
// NOTES FOR PRODUCTION DEPLOYMENT
// -----------------------------------------------------------------------------
// 
// 1. Use a process manager like PM2:
//    pm2 start server.js --name "resin-art-api"
//
// 2. Use environment variables for all configuration:
//    DATABASE_URL, JWT_SECRET, etc. should never be hardcoded
//
// 3. Enable HTTPS in production (usually handled by reverse proxy like Nginx)
//
// 4. Consider using clustering for multi-core servers:
//    const cluster = require('cluster');
//    const numCPUs = require('os').cpus().length;
//
// 5. Monitor your application:
//    - Use logging services (Winston, Morgan)
//    - Set up error tracking (Sentry, Bugsnag)
//    - Monitor performance (New Relic, Datadog)
//
// =============================================================================
