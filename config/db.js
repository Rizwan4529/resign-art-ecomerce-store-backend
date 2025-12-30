// =============================================================================
// DATABASE CONFIGURATION - Prisma Client Setup
// =============================================================================
// 
// This file sets up and exports the Prisma Client instance.
// Prisma Client is the auto-generated query builder that lets us interact
// with our database in a type-safe way.
//
// WHY THIS PATTERN?
// -----------------
// In development, hot-reloading can create multiple Prisma Client instances,
// which exhausts database connections. We use a singleton pattern to prevent this.
//
// =============================================================================

// -----------------------------------------------------------------------------
// IMPORT PRISMA CLIENT
// -----------------------------------------------------------------------------
// The @prisma/client package is auto-generated from your schema.prisma file.
// After running `npx prisma generate`, it contains:
// - Type definitions for all your models
// - Methods for all CRUD operations
// - Query builders for complex queries

const { PrismaClient } = require('@prisma/client');

// -----------------------------------------------------------------------------
// SINGLETON PATTERN FOR PRISMA CLIENT
// -----------------------------------------------------------------------------
// 
// PROBLEM:
// In development with hot-reloading (nodemon), each restart creates a new
// PrismaClient instance. Each instance opens database connections, and
// MySQL has a limited connection pool (default: 151 connections).
// This can lead to "Too many connections" errors.
//
// SOLUTION:
// Store the client on the global object so it persists across hot reloads.
// In production, this isn't necessary, but it doesn't hurt.

// Declare prisma variable
let prisma;

// Check if we're in production
if (process.env.NODE_ENV === 'production') {
  // In production, always create a new client
  // The process doesn't restart frequently, so this is fine
  prisma = new PrismaClient({
    // Logging configuration for production
    log: ['error', 'warn'],
    // Only log errors and warnings, not queries
  });
} else {
  // In development, use the singleton pattern
  
  // Check if client already exists on global object
  if (!global.__prisma) {
    // If not, create a new client and store it
    global.__prisma = new PrismaClient({
      // Logging configuration for development
      log: [
        { level: 'query', emit: 'event' },  // Log all queries
        { level: 'error', emit: 'stdout' }, // Log errors to console
        { level: 'info', emit: 'stdout' },  // Log info messages
        { level: 'warn', emit: 'stdout' },  // Log warnings
      ],
    });
    
    // ---------------------------------------------------------------------
    // QUERY LOGGING FOR DEVELOPMENT
    // ---------------------------------------------------------------------
    // This helps you see what SQL queries Prisma is generating.
    // Very useful for debugging and optimizing queries!
    
    global.__prisma.$on('query', (e) => {
      // Color-coded output for better readability
      console.log('\n🔍 Query:', e.query);
      console.log('📊 Params:', e.params);
      console.log(`⏱️  Duration: ${e.duration}ms\n`);
    });
  }
  
  // Use the global client
  prisma = global.__prisma;
}

// -----------------------------------------------------------------------------
// DATABASE CONNECTION FUNCTION
// -----------------------------------------------------------------------------
// 
// Prisma Client automatically handles connection pooling, so you don't need
// to manually connect. However, this function is useful for:
// 1. Verifying the database is reachable at startup
// 2. Logging connection status
// 3. Handling initial connection errors gracefully

/**
 * Connect to the database and verify connection
 * @returns {Promise<void>}
 */
const connectDB = async () => {
  try {
    // $connect() explicitly opens a connection to the database
    // Prisma would do this automatically on first query, but we do it
    // explicitly to catch connection errors at startup
    await prisma.$connect();
    
    console.log('✅ Database connected successfully');
    console.log(`📁 Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[1] || 'resin_art_db'}`);
    
    // Optional: Run a simple query to verify everything works
    // This is useful for catching schema mismatches early
    const result = await prisma.$queryRaw`SELECT 1 as connected`;
    if (result) {
      console.log('✅ Database query test passed');
    }
    
  } catch (error) {
    // Log detailed error information
    console.error('❌ Database connection failed!');
    console.error('Error:', error.message);
    
    // Provide helpful debugging information
    if (error.code === 'P1001') {
      console.error('\n💡 Possible causes:');
      console.error('   - MySQL server is not running');
      console.error('   - Wrong host/port in DATABASE_URL');
      console.error('   - Firewall blocking connection');
    } else if (error.code === 'P1003') {
      console.error('\n💡 Database does not exist.');
      console.error('   Run: CREATE DATABASE resin_art_db;');
    } else if (error.code === 'P1017') {
      console.error('\n💡 Server closed the connection.');
      console.error('   Check MySQL max_connections setting.');
    }
    
    // Exit process with failure code
    // This is appropriate for server startup - if DB fails, server shouldn't run
    process.exit(1);
  }
};

// -----------------------------------------------------------------------------
// GRACEFUL SHUTDOWN HANDLER
// -----------------------------------------------------------------------------
// 
// When the application shuts down (Ctrl+C, deployment restart, etc.),
// we should properly close database connections to:
// 1. Release connection pool resources
// 2. Complete any pending transactions
// 3. Prevent data corruption

/**
 * Disconnect from database gracefully
 * @returns {Promise<void>}
 */
const disconnectDB = async () => {
  try {
    await prisma.$disconnect();
    console.log('✅ Database disconnected gracefully');
  } catch (error) {
    console.error('❌ Error disconnecting from database:', error.message);
  }
};

// Handle process termination signals
// SIGINT: Ctrl+C in terminal
// SIGTERM: Process termination (e.g., from process manager)

process.on('SIGINT', async () => {
  console.log('\n📴 Received SIGINT. Shutting down gracefully...');
  await disconnectDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n📴 Received SIGTERM. Shutting down gracefully...');
  await disconnectDB();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('❌ Uncaught Exception:', error);
  await disconnectDB();
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  await disconnectDB();
  process.exit(1);
});

// -----------------------------------------------------------------------------
// PRISMA CLIENT EXTENSION EXAMPLES (Optional Advanced Feature)
// -----------------------------------------------------------------------------
// 
// Prisma allows you to extend the client with custom methods.
// This is useful for adding business logic or computed fields.
// 
// Example (uncomment to use):
// 
// const extendedPrisma = prisma.$extends({
//   model: {
//     user: {
//       // Custom method to find active users
//       async findActive() {
//         return prisma.user.findMany({
//           where: { status: 'ACTIVE' }
//         });
//       }
//     }
//   }
// });

// -----------------------------------------------------------------------------
// EXPORTS
// -----------------------------------------------------------------------------

module.exports = {
  prisma,       // The Prisma Client instance
  connectDB,    // Function to connect to database
  disconnectDB, // Function to disconnect from database
};

// -----------------------------------------------------------------------------
// USAGE EXAMPLES
// -----------------------------------------------------------------------------
// 
// Import in other files:
// const { prisma } = require('./config/db');
//
// CRUD Operations:
// 
// CREATE:
// const user = await prisma.user.create({
//   data: { name: 'John', email: 'john@example.com', password: 'hashed_password' }
// });
//
// READ (findMany with filters):
// const products = await prisma.product.findMany({
//   where: { isActive: true, category: 'JEWELRY' },
//   orderBy: { price: 'asc' },
//   take: 10,
//   skip: 0
// });
//
// READ (findUnique):
// const user = await prisma.user.findUnique({
//   where: { email: 'john@example.com' },
//   include: { orders: true }  // Include related orders
// });
//
// UPDATE:
// const updatedProduct = await prisma.product.update({
//   where: { id: 1 },
//   data: { stock: { decrement: 1 } }  // Decrease stock by 1
// });
//
// DELETE:
// await prisma.product.delete({
//   where: { id: 1 }
// });
//
// TRANSACTIONS:
// await prisma.$transaction([
//   prisma.product.update({ where: { id: 1 }, data: { stock: { decrement: 1 } } }),
//   prisma.orderItem.create({ data: { ... } })
// ]);
//
// RAW SQL (when Prisma syntax isn't enough):
// const results = await prisma.$queryRaw`SELECT * FROM users WHERE name LIKE ${`%${search}%`}`;
// -----------------------------------------------------------------------------
