// =============================================================================
// EMAIL UTILITY - Send Emails with Nodemailer
// =============================================================================
// 
// This utility handles sending emails for:
// - Password reset links (Section 5.1.4)
// - Order confirmations (SRS-50)
// - Order status updates (SRS-75)
// - Welcome emails
// - Promotional emails
//
// NODEMAILER OVERVIEW:
// --------------------
// Nodemailer is the most popular email library for Node.js.
// It supports:
// - SMTP (Gmail, Yahoo, Outlook, custom SMTP)
// - AWS SES
// - SendGrid, Mailgun, etc. (via transporters)
//
// =============================================================================

const nodemailer = require('nodemailer');
// Nodemailer is the standard for sending emails in Node.js

// =============================================================================
// CREATE EMAIL TRANSPORTER
// =============================================================================
// 
// The transporter is responsible for actually sending emails.
// We configure it once and reuse it for all emails.

/**
 * Create and configure the email transporter
 * @returns {Object} Nodemailer transporter instance
 */
const createTransporter = () => {
  // Different configuration for development vs production
  
  if (process.env.NODE_ENV === 'development') {
    // -------------------------------------------------------------------------
    // DEVELOPMENT: Use Ethereal for testing
    // -------------------------------------------------------------------------
    // Ethereal is a fake SMTP service for testing
    // Emails are caught and can be viewed at https://ethereal.email
    // This prevents accidentally sending test emails to real users!
    
    // You can also use Mailtrap, which is another testing service
    
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      // Debug options for development
      debug: true,
      logger: true,
    });
    
  } else {
    // -------------------------------------------------------------------------
    // PRODUCTION: Use real SMTP (Gmail, SendGrid, etc.)
    // -------------------------------------------------------------------------
    
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT),
      secure: process.env.EMAIL_PORT === '465', // true for SSL
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      // Connection pool for better performance
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });
  }
};

// Create transporter instance
let transporter = null;

/**
 * Get or create transporter (lazy initialization)
 * @returns {Object} Nodemailer transporter
 */
const getTransporter = () => {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
};

// =============================================================================
// SEND EMAIL FUNCTION
// =============================================================================
// 
// Main function to send emails.

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text content
 * @param {string} options.html - HTML content (optional)
 * @returns {Promise<Object>} Send result
 */
const sendEmail = async (options) => {
  try {
    const transport = getTransporter();
    
    // Email message configuration
    const message = {
      from: process.env.EMAIL_FROM || '"Resin Art Store" <noreply@resinart.com>',
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text, // Use text as fallback
    };
    
    // Add CC if provided
    if (options.cc) {
      message.cc = options.cc;
    }
    
    // Add BCC if provided
    if (options.bcc) {
      message.bcc = options.bcc;
    }
    
    // Add attachments if provided
    if (options.attachments) {
      message.attachments = options.attachments;
    }
    
    // Send the email
    const info = await transport.sendMail(message);
    
    console.log('📧 Email sent successfully!');
    console.log('   Message ID:', info.messageId);
    
    // In development, log the preview URL (Ethereal)
    if (process.env.NODE_ENV === 'development') {
      console.log('   Preview URL:', nodemailer.getTestMessageUrl(info));
    }
    
    return {
      success: true,
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info),
    };
    
  } catch (error) {
    console.error('❌ Email send failed:', error.message);
    throw new Error('Failed to send email. Please try again later.');
  }
};

// =============================================================================
// EMAIL TEMPLATES
// =============================================================================
// 
// Pre-defined templates for common emails.
// Using template functions keeps email formatting consistent.

/**
 * Generate password reset email
 * @param {string} userName - User's name
 * @param {string} resetUrl - Password reset URL with token
 * @returns {Object} Email content object
 */
const getPasswordResetEmail = (userName, resetUrl) => {
  const subject = '🔐 Reset Your Password - Resin Art Store';
  
  const text = `
Hello ${userName},

You requested to reset your password for your Resin Art Store account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 10 minutes for security reasons.

If you didn't request this, please ignore this email or contact support if you have concerns.

Best regards,
The Resin Art Team
  `.trim();
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">🎨 Resin Art Store</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333;">Password Reset Request</h2>
    
    <p>Hello <strong>${userName}</strong>,</p>
    
    <p>You requested to reset your password for your Resin Art Store account.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
        Reset Password
      </a>
    </div>
    
    <p style="color: #666; font-size: 14px;">
      ⏰ This link will expire in <strong>10 minutes</strong> for security reasons.
    </p>
    
    <p style="color: #666; font-size: 14px;">
      If you didn't request this password reset, please ignore this email or contact support if you have concerns.
    </p>
    
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    
    <p style="color: #999; font-size: 12px; text-align: center;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${resetUrl}" style="color: #667eea;">${resetUrl}</a>
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>© 2024 Resin Art Store. All rights reserved.</p>
  </div>
</body>
</html>
  `.trim();
  
  return { subject, text, html };
};

/**
 * Generate order confirmation email
 * @param {Object} order - Order details
 * @param {Object} user - User details
 * @returns {Object} Email content object
 */
const getOrderConfirmationEmail = (order, user) => {
  const subject = `✅ Order Confirmed - #${order.orderNumber}`;
  
  // Generate items list
  const itemsList = order.items
    .map(item => `- ${item.productName} x${item.quantity} - Rs. ${item.totalPrice}`)
    .join('\n');
  
  const text = `
Hello ${user.name},

Thank you for your order! We're excited to prepare your beautiful resin art pieces.

Order Number: ${order.orderNumber}
Order Date: ${new Date(order.orderedAt).toLocaleDateString()}

Items:
${itemsList}

Subtotal: Rs. ${order.subtotal}
Shipping: Rs. ${order.shippingCost}
Total: Rs. ${order.totalAmount}

Shipping Address:
${order.shippingAddress}

We'll notify you when your order ships!

Thank you for shopping with us! 🎨

Best regards,
The Resin Art Team
  `.trim();
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">🎨 Order Confirmed!</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <p>Hello <strong>${user.name}</strong>,</p>
    
    <p>Thank you for your order! We're excited to prepare your beautiful resin art pieces. ✨</p>
    
    <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #667eea;">Order Details</h3>
      <p><strong>Order Number:</strong> ${order.orderNumber}</p>
      <p><strong>Order Date:</strong> ${new Date(order.orderedAt).toLocaleDateString()}</p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 15px 0;">
      
      <h4 style="margin-bottom: 10px;">Items:</h4>
      ${order.items.map(item => `
        <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee;">
          <span>${item.productName} x${item.quantity}</span>
          <strong>Rs. ${item.totalPrice}</strong>
        </div>
      `).join('')}
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 15px 0;">
      
      <div style="display: flex; justify-content: space-between;">
        <span>Subtotal:</span>
        <span>Rs. ${order.subtotal}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Shipping:</span>
        <span>Rs. ${order.shippingCost}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; margin-top: 10px;">
        <span>Total:</span>
        <span style="color: #667eea;">Rs. ${order.totalAmount}</span>
      </div>
    </div>
    
    <div style="background: white; padding: 20px; border-radius: 5px;">
      <h4 style="margin-top: 0;">📦 Shipping Address:</h4>
      <p style="margin-bottom: 0;">${order.shippingAddress}</p>
    </div>
    
    <p style="margin-top: 20px;">We'll notify you when your order ships!</p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>Thank you for shopping with us! 🎨</p>
    <p>© 2024 Resin Art Store. All rights reserved.</p>
  </div>
</body>
</html>
  `.trim();
  
  return { subject, text, html };
};

/**
 * Generate order status update email
 * @param {Object} order - Order details
 * @param {Object} user - User details
 * @param {string} newStatus - New order status
 * @returns {Object} Email content object
 */
const getOrderStatusEmail = (order, user, newStatus) => {
  const statusEmojis = {
    CONFIRMED: '✅',
    PROCESSING: '🔄',
    SHIPPED: '🚚',
    DELIVERED: '📦',
    CANCELLED: '❌',
  };
  
  const statusMessages = {
    CONFIRMED: 'Your order has been confirmed and is being prepared!',
    PROCESSING: 'Your order is being processed and prepared for shipping.',
    SHIPPED: 'Great news! Your order has been shipped and is on its way!',
    DELIVERED: 'Your order has been delivered. Enjoy your resin art!',
    CANCELLED: 'Your order has been cancelled.',
  };
  
  const emoji = statusEmojis[newStatus] || '📋';
  const message = statusMessages[newStatus] || `Your order status has been updated to: ${newStatus}`;
  
  const subject = `${emoji} Order Update - #${order.orderNumber}`;
  
  const text = `
Hello ${user.name},

${message}

Order Number: ${order.orderNumber}
New Status: ${newStatus}

${order.delivery?.trackingNumber ? `Tracking Number: ${order.delivery.trackingNumber}` : ''}

Thank you for shopping with us!

Best regards,
The Resin Art Team
  `.trim();
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 48px;">${emoji}</h1>
    <h2 style="color: white; margin: 10px 0 0 0;">Order Update</h2>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <p>Hello <strong>${user.name}</strong>,</p>
    
    <p style="font-size: 18px;">${message}</p>
    
    <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
      <p><strong>Order Number:</strong> ${order.orderNumber}</p>
      <p><strong>Status:</strong> <span style="color: #667eea; font-weight: bold;">${newStatus}</span></p>
      ${order.delivery?.trackingNumber ? `
        <p><strong>Tracking Number:</strong> ${order.delivery.trackingNumber}</p>
        ${order.delivery?.trackingUrl ? `<p><a href="${order.delivery.trackingUrl}" style="color: #667eea;">Track Your Package →</a></p>` : ''}
      ` : ''}
    </div>
    
    <p>Thank you for shopping with us!</p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>© 2024 Resin Art Store. All rights reserved.</p>
  </div>
</body>
</html>
  `.trim();
  
  return { subject, text, html };
};

/**
 * Generate welcome email for new users
 * @param {Object} user - User details
 * @returns {Object} Email content object
 */
const getWelcomeEmail = (user) => {
  const subject = '🎨 Welcome to Resin Art Store!';
  
  const text = `
Hello ${user.name},

Welcome to Resin Art Store! We're thrilled to have you join our community of resin art enthusiasts.

What you can do:
✨ Browse our unique handmade resin art pieces
🔍 View products in stunning 360° detail
🛒 Add favorites to your cart
📦 Track your orders in real-time
⭐ Leave reviews on products you love

Start exploring our collection today!

If you have any questions, feel free to reach out to our support team.

Happy shopping! 🎨

Best regards,
The Resin Art Team
  `.trim();
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">🎨 Welcome!</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">You're now part of the Resin Art family</p>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <p>Hello <strong>${user.name}</strong>,</p>
    
    <p>Welcome to Resin Art Store! We're thrilled to have you join our community of resin art enthusiasts. 🎉</p>
    
    <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #667eea;">What you can do:</h3>
      <p>✨ Browse our unique handmade resin art pieces</p>
      <p>🔍 View products in stunning 360° detail</p>
      <p>🛒 Add favorites to your cart</p>
      <p>📦 Track your orders in real-time</p>
      <p>⭐ Leave reviews on products you love</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/products" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
        Start Shopping →
      </a>
    </div>
    
    <p>If you have any questions, feel free to reach out to our support team.</p>
    
    <p>Happy shopping! 🎨</p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>© 2024 Resin Art Store. All rights reserved.</p>
  </div>
</body>
</html>
  `.trim();
  
  return { subject, text, html };
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  sendEmail,                  // Main send function
  getPasswordResetEmail,      // Password reset template
  getOrderConfirmationEmail,  // Order confirmation template
  getOrderStatusEmail,        // Order status update template
  getWelcomeEmail,            // Welcome email template
};

// =============================================================================
// USAGE EXAMPLES
// =============================================================================
// 
// // Send password reset email
// const { getPasswordResetEmail, sendEmail } = require('./utils/sendEmail');
// 
// const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
// const { subject, text, html } = getPasswordResetEmail(user.name, resetUrl);
// 
// await sendEmail({
//   to: user.email,
//   subject,
//   text,
//   html,
// });
// 
// // Send order confirmation
// const { getOrderConfirmationEmail, sendEmail } = require('./utils/sendEmail');
// 
// const { subject, text, html } = getOrderConfirmationEmail(order, user);
// await sendEmail({ to: user.email, subject, text, html });
//
// =============================================================================
