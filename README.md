# 🎨 Resin Art E-Commerce Backend

A full-featured e-commerce backend API built with **Node.js**, **Express**, **MySQL**, and **Prisma ORM**. This project is designed for an online resin art store and includes comprehensive features for product management, user authentication, order processing, and more.

## 📚 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [API Endpoints](#api-endpoints)
- [Testing](#testing)
- [Deployment](#deployment)

## ✨ Features

Based on the Software Requirements Specification (SRS):

### 5.1 Security Management
- ✅ User signup with validation
- ✅ User login with JWT authentication
- ✅ Password change (logged in)
- ✅ Forgot password with email reset

### 5.2 Product Management
- ✅ Add, update, delete products (Admin)
- ✅ Search and filter products
- ✅ Customizable products support
- ✅ View all products with pagination

### 5.3 User Management
- ✅ Block/Unblock users (Admin)
- ✅ User profiles
- ✅ View all users (Admin)

### 5.4 Cart Management
- ✅ Add to cart
- ✅ View cart
- ✅ Update quantities
- ✅ Remove items

### 5.5 Order Management
- ✅ Create orders
- ✅ Order confirmation
- ✅ Process orders
- ✅ Cancel orders
- ✅ View order history

### 5.6 Payment Management
- ✅ Multiple payment methods
- ✅ Payment processing
- ✅ Payment status tracking

### 5.7-5.8 Delivery & Tracking
- ✅ Delivery management
- ✅ Order tracking updates
- ✅ Tracking history

### 5.9 Stock Management
- ✅ Stock level tracking
- ✅ Low stock alerts
- ✅ Bulk stock updates

### 5.10 Review Management
- ✅ Add feedback/ratings
- ✅ View product reviews
- ✅ Review moderation (Admin)

### 5.12 Notifications
- ✅ User notifications
- ✅ Notification preferences
- ✅ Chat messaging

### 5.13-5.14 Reports & Expenses
- ✅ Profit calculations
- ✅ Expense tracking
- ✅ Budget management
- ✅ Dashboard analytics

## 🛠 Tech Stack

| Technology | Purpose |
|------------|---------|
| **Node.js** | JavaScript runtime |
| **Express.js** | Web framework |
| **MySQL** | Relational database |
| **Prisma** | ORM (Object-Relational Mapping) |
| **JWT** | Authentication tokens |
| **bcryptjs** | Password hashing |
| **Nodemailer** | Email sending |

## 📁 Project Structure

```
resin-art-backend/
├── config/
│   └── db.js              # Database configuration
├── controllers/
│   ├── authController.js       # Authentication logic
│   ├── userController.js       # User management
│   ├── productController.js    # Product CRUD
│   ├── cartController.js       # Shopping cart
│   ├── orderController.js      # Order processing
│   ├── paymentController.js    # Payment handling
│   ├── reviewController.js     # Reviews & ratings
│   ├── stockController.js      # Stock management
│   ├── reportController.js     # Reports & analytics
│   └── notificationController.js # Notifications
├── middleware/
│   ├── authMiddleware.js  # JWT verification
│   └── errorMiddleware.js # Error handling
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.js            # Test data seeder
├── routes/
│   ├── authRoutes.js
│   ├── userRoutes.js
│   ├── productRoutes.js
│   ├── cartRoutes.js
│   ├── orderRoutes.js
│   ├── paymentRoutes.js
│   ├── reviewRoutes.js
│   ├── stockRoutes.js
│   ├── reportRoutes.js
│   └── notificationRoutes.js
├── utils/
│   ├── generateToken.js   # JWT token generation
│   └── sendEmail.js       # Email utilities
├── app.js                 # Express app configuration
├── server.js              # Server entry point
├── package.json
├── .env.example           # Environment template
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MySQL Server (v8.0 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd resin-art-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Create MySQL database**
   ```sql
   CREATE DATABASE resin_art_db;
   ```

5. **Generate Prisma client**
   ```bash
   npx prisma generate
   ```

6. **Push schema to database**
   ```bash
   npx prisma db push
   ```

7. **Seed the database (optional)**
   ```bash
   node prisma/seed.js
   ```

8. **Start the server**
   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

## 🔐 Environment Variables

Create a `.env` file in the root directory:

```env
# Server
NODE_ENV=development
PORT=5000

# Database
DATABASE_URL="mysql://root:password@localhost:3306/resin_art_db"

# JWT
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRE=30d

# Email (Gmail)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM="Resin Art Store <noreply@resinart.com>"

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

## 🗄 Database Setup

### Using Prisma CLI

```bash
# Generate Prisma Client
npx prisma generate

# Push schema to database (development)
npx prisma db push

# Create migration (production)
npx prisma migrate dev --name init

# View database in browser
npx prisma studio

# Seed database
node prisma/seed.js
```

### Test Accounts (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@resinart.com | admin123 |
| User | john@example.com | password123 |
| User | jane@example.com | password123 |

## 📡 API Endpoints

### Authentication (`/api/auth`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/signup` | Register new user | Public |
| POST | `/login` | Login user | Public |
| GET | `/me` | Get current user | Private |
| PUT | `/profile` | Update profile | Private |
| PUT | `/change-password` | Change password | Private |
| POST | `/forgot-password` | Request reset email | Public |
| POST | `/reset-password/:token` | Reset with token | Public |

### Users (`/api/users`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/` | Get all users | Admin |
| GET | `/:id` | Get user by ID | Admin |
| PUT | `/:id/block` | Block user | Admin |
| PUT | `/:id/unblock` | Unblock user | Admin |
| GET | `/stats` | User statistics | Admin |

### Products (`/api/products`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/` | Get all products | Public |
| GET | `/:id` | Get product by ID | Public |
| GET | `/featured` | Get featured products | Public |
| GET | `/category/:category` | Get by category | Public |
| GET | `/search` | Search products | Public |
| POST | `/` | Create product | Admin |
| PUT | `/:id` | Update product | Admin |
| DELETE | `/:id` | Delete product | Admin |

### Cart (`/api/cart`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/` | Get user's cart | Private |
| POST | `/` | Add to cart | Private |
| PUT | `/:itemId` | Update quantity | Private |
| DELETE | `/:itemId` | Remove item | Private |
| DELETE | `/` | Clear cart | Private |

### Orders (`/api/orders`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/my-orders` | Get user's orders | Private |
| POST | `/` | Create order | Private |
| GET | `/:id` | Get order details | Private |
| GET | `/:id/tracking` | Get tracking | Private |
| PUT | `/:id/cancel` | Cancel order | Private |
| GET | `/` | Get all orders | Admin |
| PUT | `/:id/status` | Update status | Admin |

### Reviews (`/api/reviews`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/product/:productId` | Get product reviews | Public |
| GET | `/my-reviews` | Get user's reviews | Private |
| POST | `/` | Create review | Private |
| PUT | `/:id` | Update review | Private |
| DELETE | `/:id` | Delete review | Private |

### Stock (`/api/stock`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/` | Get stock levels | Admin |
| GET | `/alerts` | Low stock alerts | Admin |
| PUT | `/:productId` | Update stock | Admin |
| PUT | `/bulk` | Bulk update | Admin |

### Reports (`/api/reports`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/dashboard` | Dashboard summary | Admin |
| GET | `/profit` | Profit summary | Admin |
| GET | `/expenses` | Get expenses | Admin |
| POST | `/expenses` | Add expense | Admin |
| GET | `/budgets` | Get budgets | Admin |
| POST | `/budgets` | Set budget | Admin |

## 🧪 Testing

### Using cURL

```bash
# Signup
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Get products
curl http://localhost:5000/api/products

# Protected route (with token)
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Using Postman

1. Import the API endpoints
2. Set up environment variable for `token`
3. Use Tests script to auto-save token:
   ```javascript
   if (pm.response.json().data?.token) {
     pm.environment.set("token", pm.response.json().data.token);
   }
   ```

## 🚢 Deployment

### Environment Setup
```bash
NODE_ENV=production
```

### Using PM2
```bash
npm install -g pm2
pm2 start server.js --name "resin-art-api"
pm2 save
pm2 startup
```

### Database Migrations (Production)
```bash
npx prisma migrate deploy
```

## 📝 License

MIT License - feel free to use this project for learning and development.

## 🙏 Acknowledgments

- Built as an educational project
- Based on E-Commerce Website for Resin Art SRS document
- Uses Prisma ORM for type-safe database access
