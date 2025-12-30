# 🧪 API Testing Guide

Complete guide for testing the Resin Art E-Commerce API with cURL and Postman.

---

## Quick Start

```bash
# Start the server
npm run dev

# Server runs at: http://localhost:5000
# API base URL: http://localhost:5000/api
```

---

## Authentication Endpoints

### 1. Signup

```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123",
    "phone": "+92-300-1234567"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Account created successfully! Welcome to Resin Art Store.",
  "data": {
    "user": {
      "id": 1,
      "name": "Test User",
      "email": "test@example.com",
      "role": "USER"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 2. Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@resinart.com",
    "password": "admin123"
  }'
```

### 3. Get Current User

```bash
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 4. Update Profile

```bash
curl -X PUT http://localhost:5000/api/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name",
    "phone": "+92-321-9999999",
    "address": "New Address, Islamabad"
  }'
```

### 5. Change Password

```bash
curl -X PUT http://localhost:5000/api/auth/change-password \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "password123",
    "newPassword": "newpassword456",
    "confirmPassword": "newpassword456"
  }'
```

### 6. Forgot Password

```bash
curl -X POST http://localhost:5000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }'
```

### 7. Reset Password

```bash
curl -X POST http://localhost:5000/api/auth/reset-password/RESET_TOKEN_HERE \
  -H "Content-Type: application/json" \
  -d '{
    "password": "newpassword123",
    "confirmPassword": "newpassword123"
  }'
```

---

## Product Endpoints

### Get All Products (with filters)

```bash
# Basic
curl http://localhost:5000/api/products

# With filters
curl "http://localhost:5000/api/products?category=JEWELRY&minPrice=1000&maxPrice=5000&page=1&limit=10"

# With search
curl "http://localhost:5000/api/products?search=ocean"

# Featured only
curl "http://localhost:5000/api/products?featured=true"
```

### Get Single Product

```bash
curl http://localhost:5000/api/products/1
```

### Get Featured Products

```bash
curl http://localhost:5000/api/products/featured
```

### Get Products by Category

```bash
curl http://localhost:5000/api/products/category/JEWELRY
```

### Search Products

```bash
curl "http://localhost:5000/api/products/search?q=ocean&category=COASTERS"
```

### Create Product (Admin)

```bash
curl -X POST http://localhost:5000/api/products \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Resin Art Piece",
    "description": "Beautiful handmade resin art",
    "price": 2500,
    "category": "HOME_DECOR",
    "stock": 10,
    "isFeatured": true,
    "images": ["https://example.com/image1.jpg"],
    "tags": ["handmade", "decor"]
  }'
```

### Update Product (Admin)

```bash
curl -X PUT http://localhost:5000/api/products/1 \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "price": 2800,
    "stock": 15
  }'
```

### Delete Product (Admin)

```bash
curl -X DELETE http://localhost:5000/api/products/1 \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## Cart Endpoints

### Get Cart

```bash
curl http://localhost:5000/api/cart \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Add to Cart

```bash
curl -X POST http://localhost:5000/api/cart \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 1,
    "quantity": 2
  }'
```

### Update Cart Item

```bash
curl -X PUT http://localhost:5000/api/cart/1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 3
  }'
```

### Remove from Cart

```bash
curl -X DELETE http://localhost:5000/api/cart/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Clear Cart

```bash
curl -X DELETE http://localhost:5000/api/cart \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Order Endpoints

### Create Order

```bash
curl -X POST http://localhost:5000/api/orders \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shippingAddress": "123 Main St, Islamabad, Pakistan",
    "shippingPhone": "+92-300-1234567",
    "paymentMethod": "COD",
    "notes": "Please call before delivery"
  }'
```

### Get My Orders

```bash
curl http://localhost:5000/api/orders/my-orders \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Order by ID

```bash
curl http://localhost:5000/api/orders/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Order Tracking

```bash
curl http://localhost:5000/api/orders/1/tracking \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Cancel Order

```bash
curl -X PUT http://localhost:5000/api/orders/1/cancel \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Changed my mind"
  }'
```

### Get All Orders (Admin)

```bash
curl "http://localhost:5000/api/orders?status=PENDING&page=1" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Update Order Status (Admin)

```bash
curl -X PUT http://localhost:5000/api/orders/1/status \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "PROCESSING"
  }'
```

---

## Review Endpoints

### Get Product Reviews

```bash
curl http://localhost:5000/api/reviews/product/1
```

### Create Review

```bash
curl -X POST http://localhost:5000/api/reviews \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 1,
    "rating": 5,
    "comment": "Absolutely beautiful! Love it!"
  }'
```

### Get My Reviews

```bash
curl http://localhost:5000/api/reviews/my-reviews \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Update Review

```bash
curl -X PUT http://localhost:5000/api/reviews/1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 4,
    "comment": "Updated review"
  }'
```

### Delete Review

```bash
curl -X DELETE http://localhost:5000/api/reviews/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## User Management (Admin)

### Get All Users

```bash
curl "http://localhost:5000/api/users?page=1&limit=10&role=USER" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Get User by ID

```bash
curl http://localhost:5000/api/users/2 \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Block User

```bash
curl -X PUT http://localhost:5000/api/users/2/block \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Violation of terms"
  }'
```

### Unblock User

```bash
curl -X PUT http://localhost:5000/api/users/2/unblock \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### User Statistics

```bash
curl http://localhost:5000/api/users/stats \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## Stock Management (Admin)

### Get Stock Levels

```bash
curl "http://localhost:5000/api/stock?lowStock=true" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Get Low Stock Alerts

```bash
curl "http://localhost:5000/api/stock/alerts?threshold=10" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Update Stock

```bash
curl -X PUT http://localhost:5000/api/stock/1 \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 50,
    "operation": "set"
  }'
```

### Bulk Update Stock

```bash
curl -X PUT http://localhost:5000/api/stock/bulk \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "updates": [
      {"productId": 1, "quantity": 100},
      {"productId": 2, "quantity": 50}
    ]
  }'
```

---

## Reports (Admin)

### Dashboard Summary

```bash
curl http://localhost:5000/api/reports/dashboard \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Profit Summary

```bash
curl "http://localhost:5000/api/reports/profit?startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Get Expenses

```bash
curl "http://localhost:5000/api/reports/expenses?category=RAW_MATERIALS" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Add Expense

```bash
curl -X POST http://localhost:5000/api/reports/expenses \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "RAW_MATERIALS",
    "amount": 5000,
    "description": "Purchased epoxy resin",
    "date": "2024-01-15"
  }'
```

### Set Budget

```bash
curl -X POST http://localhost:5000/api/reports/budgets \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "RAW_MATERIALS",
    "limitAmount": 25000,
    "month": 1,
    "year": 2024
  }'
```

---

## Notifications

### Get Notifications

```bash
curl "http://localhost:5000/api/notifications?unreadOnly=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Mark as Read

```bash
curl -X PUT http://localhost:5000/api/notifications/1/read \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Mark All as Read

```bash
curl -X PUT http://localhost:5000/api/notifications/read-all \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Preferences

```bash
curl http://localhost:5000/api/notifications/preferences \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Update Preferences

```bash
curl -X PUT http://localhost:5000/api/notifications/preferences \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "smsNotifications": true,
    "pushNotifications": false,
    "emailNotifications": true
  }'
```

---

## Postman Setup

### Environment Variables

Create an environment with these variables:

| Variable | Initial Value |
|----------|--------------|
| `base_url` | `http://localhost:5000/api` |
| `token` | (empty - auto-filled on login) |
| `admin_token` | (empty - auto-filled on admin login) |

### Auto-Save Token Script

Add this to **Tests** tab of login request:

```javascript
if (pm.response.code === 200) {
    const response = pm.response.json();
    if (response.data && response.data.token) {
        pm.environment.set("token", response.data.token);
        console.log("Token saved successfully!");
    }
}
```

### Authorization Header

For protected routes, set:
- Type: `Bearer Token`
- Token: `{{token}}`

---

## Test Scenarios

### Complete User Flow

1. **Signup** → Save token
2. **Login** → Verify token works
3. **View Products** → Browse catalog
4. **Add to Cart** → Add items
5. **View Cart** → Verify items
6. **Create Order** → Place order
7. **View Orders** → Check order status
8. **Add Review** → Review purchased product

### Admin Flow

1. **Login as Admin** → admin@resinart.com
2. **View Dashboard** → Check stats
3. **Manage Products** → Add/edit products
4. **Manage Stock** → Check alerts
5. **View Orders** → Process orders
6. **Manage Users** → Block/unblock
7. **View Reports** → Check profit/expenses

---

## Error Response Format

All errors follow this format:

```json
{
  "success": false,
  "message": "Error description here",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

| Status | Meaning |
|--------|---------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - No/invalid token |
| 403 | Forbidden - No permission |
| 404 | Not Found |
| 500 | Server Error |

---

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@resinart.com | admin123 |
| User | john@example.com | password123 |
| User | jane@example.com | password123 |

---

Happy Testing! 🚀
