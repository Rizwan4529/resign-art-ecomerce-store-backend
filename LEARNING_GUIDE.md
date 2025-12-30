# 📖 Prisma & MySQL Learning Guide

A comprehensive guide to understanding Prisma ORM with MySQL for Node.js backend development.

---

## Table of Contents

1. [What is Prisma?](#1-what-is-prisma)
2. [Prisma vs Mongoose](#2-prisma-vs-mongoose)
3. [Setting Up Prisma](#3-setting-up-prisma)
4. [Prisma Schema Deep Dive](#4-prisma-schema-deep-dive)
5. [CRUD Operations with Prisma](#5-crud-operations-with-prisma)
6. [Relationships & Joins](#6-relationships--joins)
7. [Advanced Queries](#7-advanced-queries)
8. [Transactions](#8-transactions)
9. [Authentication with JWT](#9-authentication-with-jwt)
10. [Error Handling](#10-error-handling)
11. [Best Practices](#11-best-practices)

---

## 1. What is Prisma?

Prisma is a **next-generation ORM** (Object-Relational Mapping) for Node.js and TypeScript. It makes database access easy with an auto-generated and type-safe query builder.

### Prisma Components

```
┌─────────────────────────────────────────────────────────┐
│                    PRISMA ECOSYSTEM                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │  Prisma Client   │  │  Prisma Migrate  │            │
│  │  (Query Builder) │  │  (Migrations)    │            │
│  └────────┬─────────┘  └────────┬─────────┘            │
│           │                      │                       │
│           └──────────┬──────────┘                       │
│                      │                                   │
│           ┌──────────▼──────────┐                       │
│           │   Prisma Schema     │                       │
│           │   (schema.prisma)   │                       │
│           └──────────┬──────────┘                       │
│                      │                                   │
│           ┌──────────▼──────────┐                       │
│           │   Prisma Studio     │                       │
│           │   (GUI Database)    │                       │
│           └─────────────────────┘                       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Why Prisma?

| Feature | Benefit |
|---------|---------|
| **Type Safety** | Catches errors at compile time |
| **Auto-completion** | IDE knows your database schema |
| **Migrations** | Version control for your database |
| **Relations** | Easy to define and query relationships |
| **Raw SQL** | Escape hatch when needed |

---

## 2. Prisma vs Mongoose

| Aspect | Prisma (SQL) | Mongoose (MongoDB) |
|--------|--------------|-------------------|
| **Database** | MySQL, PostgreSQL, SQLite, SQL Server | MongoDB only |
| **Schema** | `schema.prisma` file | JavaScript/TypeScript schemas |
| **Relations** | Native SQL JOINs | Manual population |
| **Type Safety** | Built-in TypeScript types | Requires manual typing |
| **Migrations** | Built-in migration system | Manual or third-party |
| **Query Builder** | Fluent API | Chainable methods |

### Query Comparison

```javascript
// MONGOOSE (MongoDB)
const users = await User.find({ status: 'active' })
  .populate('orders')
  .sort({ createdAt: -1 })
  .limit(10);

// PRISMA (MySQL)
const users = await prisma.user.findMany({
  where: { status: 'ACTIVE' },
  include: { orders: true },
  orderBy: { createdAt: 'desc' },
  take: 10,
});
```

---

## 3. Setting Up Prisma

### Installation

```bash
# Install Prisma CLI and Client
npm install prisma @prisma/client

# Initialize Prisma (creates prisma folder)
npx prisma init
```

### Project Structure

```
project/
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── migrations/      # Migration files
├── node_modules/
│   └── @prisma/client/  # Generated client
└── .env                 # Database URL
```

### Configure Database URL

```env
# MySQL
DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DATABASE"

# Example
DATABASE_URL="mysql://root:password@localhost:3306/resin_art_db"
```

### Common Commands

```bash
# Generate Prisma Client (after schema changes)
npx prisma generate

# Push schema to database (development)
npx prisma db push

# Create migration (production)
npx prisma migrate dev --name migration_name

# Apply migrations (production)
npx prisma migrate deploy

# Open database GUI
npx prisma studio

# Format schema file
npx prisma format
```

---

## 4. Prisma Schema Deep Dive

### Basic Structure

```prisma
// Generator - What to generate
generator client {
  provider = "prisma-client-js"
}

// Datasource - Database connection
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// Models - Your tables
model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
}
```

### Field Types

```prisma
model Example {
  // Integers
  id        Int      @id @default(autoincrement())
  count     Int      @default(0)
  
  // Strings
  name      String   @db.VarChar(100)
  bio       String   @db.Text
  
  // Booleans
  isActive  Boolean  @default(true)
  
  // Decimals (for money)
  price     Decimal  @db.Decimal(10, 2)
  
  // Dates
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  birthday  DateTime @db.Date
  
  // JSON (flexible data)
  metadata  Json?
  
  // Enums
  status    Status   @default(ACTIVE)
}

enum Status {
  ACTIVE
  INACTIVE
  BLOCKED
}
```

### Field Modifiers

```prisma
model User {
  // @id - Primary key
  id Int @id @default(autoincrement())
  
  // @unique - Unique constraint
  email String @unique
  
  // @default - Default value
  role String @default("USER")
  createdAt DateTime @default(now())
  
  // @updatedAt - Auto-update timestamp
  updatedAt DateTime @updatedAt
  
  // ? - Optional field (nullable)
  phone String?
  
  // @map - Map to different column name
  firstName String @map("first_name")
  
  // @db - Database-specific type
  bio String @db.Text
  
  // @@map - Map to different table name
  @@map("users")
  
  // @@index - Create index
  @@index([email])
  
  // @@unique - Composite unique
  @@unique([firstName, lastName])
}
```

### Relations

```prisma
// ONE-TO-MANY: User has many Orders
model User {
  id     Int     @id @default(autoincrement())
  orders Order[]  // Virtual field - no column in DB
}

model Order {
  id     Int  @id @default(autoincrement())
  userId Int  @map("user_id")  // Foreign key column
  user   User @relation(fields: [userId], references: [id])
}

// ONE-TO-ONE: User has one Profile
model User {
  id      Int      @id @default(autoincrement())
  profile Profile?
}

model Profile {
  id     Int  @id @default(autoincrement())
  userId Int  @unique @map("user_id")
  user   User @relation(fields: [userId], references: [id])
}

// MANY-TO-MANY: Products in Orders (via junction table)
model Product {
  id         Int         @id @default(autoincrement())
  orderItems OrderItem[]
}

model Order {
  id    Int         @id @default(autoincrement())
  items OrderItem[]
}

model OrderItem {
  id        Int     @id @default(autoincrement())
  orderId   Int     @map("order_id")
  productId Int     @map("product_id")
  quantity  Int
  order     Order   @relation(fields: [orderId], references: [id])
  product   Product @relation(fields: [productId], references: [id])
}
```

---

## 5. CRUD Operations with Prisma

### Create

```javascript
// Create one
const user = await prisma.user.create({
  data: {
    name: 'John Doe',
    email: 'john@example.com',
    password: hashedPassword,
  },
});

// Create with relations
const order = await prisma.order.create({
  data: {
    userId: 1,
    items: {
      create: [
        { productId: 1, quantity: 2 },
        { productId: 3, quantity: 1 },
      ],
    },
  },
  include: { items: true },
});

// Create many
const users = await prisma.user.createMany({
  data: [
    { name: 'Alice', email: 'alice@example.com' },
    { name: 'Bob', email: 'bob@example.com' },
  ],
});
```

### Read

```javascript
// Find unique (by unique field)
const user = await prisma.user.findUnique({
  where: { email: 'john@example.com' },
});

// Find first (any condition)
const user = await prisma.user.findFirst({
  where: { name: { contains: 'John' } },
});

// Find many with filters
const products = await prisma.product.findMany({
  where: {
    isActive: true,
    price: { gte: 100, lte: 500 },
    category: 'JEWELRY',
  },
  orderBy: { price: 'asc' },
  skip: 0,  // Offset
  take: 10, // Limit
});

// Select specific fields
const users = await prisma.user.findMany({
  select: {
    id: true,
    name: true,
    email: true,
    // Don't include password!
  },
});

// Include relations
const order = await prisma.order.findUnique({
  where: { id: 1 },
  include: {
    user: true,
    items: {
      include: { product: true },
    },
  },
});
```

### Update

```javascript
// Update one
const user = await prisma.user.update({
  where: { id: 1 },
  data: { name: 'John Smith' },
});

// Update with increment/decrement
const product = await prisma.product.update({
  where: { id: 1 },
  data: {
    stock: { decrement: 1 }, // Decrease by 1
    // stock: { increment: 5 }, // Increase by 5
  },
});

// Update many
const result = await prisma.user.updateMany({
  where: { status: 'INACTIVE' },
  data: { status: 'ACTIVE' },
});
console.log(`Updated ${result.count} users`);

// Upsert (update or create)
const user = await prisma.user.upsert({
  where: { email: 'john@example.com' },
  update: { name: 'John Updated' },
  create: {
    email: 'john@example.com',
    name: 'John New',
  },
});
```

### Delete

```javascript
// Delete one
await prisma.user.delete({
  where: { id: 1 },
});

// Delete many
const result = await prisma.product.deleteMany({
  where: { stock: 0 },
});
console.log(`Deleted ${result.count} products`);
```

---

## 6. Relationships & Joins

### Include (Eager Loading)

```javascript
// Include all orders for a user
const user = await prisma.user.findUnique({
  where: { id: 1 },
  include: {
    orders: true,
  },
});

// Nested includes
const user = await prisma.user.findUnique({
  where: { id: 1 },
  include: {
    orders: {
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    },
  },
});

// Include with filters
const user = await prisma.user.findUnique({
  where: { id: 1 },
  include: {
    orders: {
      where: { status: 'DELIVERED' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    },
  },
});
```

### Select with Relations

```javascript
// Select specific fields including relations
const user = await prisma.user.findUnique({
  where: { id: 1 },
  select: {
    id: true,
    name: true,
    orders: {
      select: {
        id: true,
        totalAmount: true,
      },
    },
  },
});
```

### Count Relations

```javascript
// Count related records
const user = await prisma.user.findUnique({
  where: { id: 1 },
  include: {
    _count: {
      select: {
        orders: true,
        reviews: true,
      },
    },
  },
});
// Result: user._count.orders, user._count.reviews
```

---

## 7. Advanced Queries

### Filtering

```javascript
// Complex filters
const products = await prisma.product.findMany({
  where: {
    // AND (all conditions must match)
    AND: [
      { isActive: true },
      { stock: { gt: 0 } },
    ],
    
    // OR (any condition matches)
    OR: [
      { category: 'JEWELRY' },
      { category: 'COASTERS' },
    ],
    
    // NOT
    NOT: { status: 'DELETED' },
    
    // String filters
    name: { contains: 'ocean' },        // LIKE '%ocean%'
    name: { startsWith: 'Ocean' },      // LIKE 'Ocean%'
    name: { endsWith: 'set' },          // LIKE '%set'
    
    // Number comparisons
    price: { gt: 100 },                 // > 100
    price: { gte: 100 },                // >= 100
    price: { lt: 500 },                 // < 500
    price: { lte: 500 },                // <= 500
    
    // In array
    category: { in: ['JEWELRY', 'COASTERS'] },
    category: { notIn: ['CUSTOM'] },
    
    // Null checks
    description: { not: null },
  },
});
```

### Sorting

```javascript
const products = await prisma.product.findMany({
  orderBy: [
    { isFeatured: 'desc' },  // Featured first
    { createdAt: 'desc' },   // Then newest
  ],
});
```

### Pagination

```javascript
// Offset pagination
const page = 1;
const pageSize = 10;

const products = await prisma.product.findMany({
  skip: (page - 1) * pageSize,
  take: pageSize,
});

// Get total count for pagination info
const totalCount = await prisma.product.count();
const totalPages = Math.ceil(totalCount / pageSize);
```

### Aggregations

```javascript
// Count
const count = await prisma.product.count({
  where: { isActive: true },
});

// Aggregate
const stats = await prisma.product.aggregate({
  _count: true,
  _sum: { stock: true },
  _avg: { price: true },
  _min: { price: true },
  _max: { price: true },
});

// Group by
const byCategory = await prisma.product.groupBy({
  by: ['category'],
  _count: true,
  _sum: { stock: true },
  _avg: { price: true },
});
```

### Raw SQL

```javascript
// Raw query
const users = await prisma.$queryRaw`
  SELECT * FROM users 
  WHERE name LIKE ${`%${search}%`}
`;

// Raw execute (for INSERT, UPDATE, DELETE)
await prisma.$executeRaw`
  UPDATE products 
  SET stock = stock - 1 
  WHERE id = ${productId}
`;
```

---

## 8. Transactions

### Sequential Operations

```javascript
// Array of operations
const [order, updatedProduct] = await prisma.$transaction([
  prisma.order.create({
    data: { userId: 1, totalAmount: 100 },
  }),
  prisma.product.update({
    where: { id: 1 },
    data: { stock: { decrement: 1 } },
  }),
]);
```

### Interactive Transaction

```javascript
// For complex logic
const result = await prisma.$transaction(async (tx) => {
  // Check stock
  const product = await tx.product.findUnique({
    where: { id: productId },
  });
  
  if (product.stock < quantity) {
    throw new Error('Insufficient stock');
  }
  
  // Create order
  const order = await tx.order.create({
    data: {
      userId,
      items: {
        create: { productId, quantity },
      },
    },
  });
  
  // Update stock
  await tx.product.update({
    where: { id: productId },
    data: { stock: { decrement: quantity } },
  });
  
  return order;
});
```

---

## 9. Authentication with JWT

### Password Hashing (bcrypt)

```javascript
const bcrypt = require('bcryptjs');

// Hash password (signup)
const salt = await bcrypt.genSalt(10);
const hashedPassword = await bcrypt.hash(password, salt);

// Compare password (login)
const isMatch = await bcrypt.compare(password, user.password);
```

### JWT Token

```javascript
const jwt = require('jsonwebtoken');

// Generate token
const token = jwt.sign(
  { userId: user.id },
  process.env.JWT_SECRET,
  { expiresIn: '30d' }
);

// Verify token
const decoded = jwt.verify(token, process.env.JWT_SECRET);
// decoded.userId
```

### Auth Middleware

```javascript
const protect = async (req, res, next) => {
  let token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Not authorized' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};
```

---

## 10. Error Handling

### Prisma Error Codes

| Code | Meaning |
|------|---------|
| P2002 | Unique constraint violation |
| P2025 | Record not found |
| P2003 | Foreign key constraint failed |
| P2024 | Connection pool timeout |

### Error Handler Middleware

```javascript
const errorHandler = (err, req, res, next) => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  
  // Unique constraint (duplicate)
  if (err.code === 'P2002') {
    statusCode = 400;
    message = `Duplicate value for ${err.meta?.target}`;
  }
  
  // Not found
  if (err.code === 'P2025') {
    statusCode = 404;
    message = 'Record not found';
  }
  
  res.status(statusCode).json({ success: false, message });
};
```

---

## 11. Best Practices

### 1. Use Select to Exclude Sensitive Data

```javascript
// DON'T - exposes password
const user = await prisma.user.findUnique({ where: { id } });

// DO - exclude password
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    name: true,
    email: true,
    // password: false (not needed, just don't include)
  },
});
```

### 2. Singleton Pattern for Prisma Client

```javascript
// config/db.js
let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient();
  }
  prisma = global.__prisma;
}

module.exports = { prisma };
```

### 3. Handle Disconnection

```javascript
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
```

### 4. Use Transactions for Related Operations

```javascript
// Always use transactions when:
// - Creating/updating multiple related records
// - Operations that must succeed or fail together
// - Financial operations
```

### 5. Index Important Fields

```prisma
model Product {
  id       Int    @id @default(autoincrement())
  name     String
  category String
  price    Decimal
  
  @@index([category])
  @@index([price])
  @@index([name])  // For search
}
```

---

## Quick Reference

### Common Operations Cheat Sheet

```javascript
// CREATE
prisma.model.create({ data: {} })
prisma.model.createMany({ data: [] })

// READ
prisma.model.findUnique({ where: { id: 1 } })
prisma.model.findFirst({ where: {} })
prisma.model.findMany({ where: {}, orderBy: {}, skip: 0, take: 10 })

// UPDATE
prisma.model.update({ where: { id: 1 }, data: {} })
prisma.model.updateMany({ where: {}, data: {} })
prisma.model.upsert({ where: {}, update: {}, create: {} })

// DELETE
prisma.model.delete({ where: { id: 1 } })
prisma.model.deleteMany({ where: {} })

// AGGREGATE
prisma.model.count({ where: {} })
prisma.model.aggregate({ _sum: {}, _avg: {}, _count: true })
prisma.model.groupBy({ by: ['field'], _count: true })
```

---

Happy coding! 🚀
