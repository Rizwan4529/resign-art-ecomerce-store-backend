// =============================================================================
// NOTIFICATION ROUTES - Notification & Communication Routes
// =============================================================================
// 
// Routes for notifications (Section 5.12)
// Base path: /api/notifications
//
// =============================================================================

const express = require('express');
const router = express.Router();

const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  sendBulkNotifications,
  getPreferences,
  updatePreferences,
  sendChatMessage,
  getChatHistory,
  getChatRooms,
} = require('../controllers/notificationController');

const { protect, authorize } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// =============================================================================
// USER NOTIFICATION ROUTES
// =============================================================================

// @route   GET /api/notifications
// @desc    Get user's notifications
// @access  Private
router.get('/', getNotifications);

// @route   PUT /api/notifications/read-all
// @desc    Mark all as read
// @access  Private
router.put('/read-all', markAllAsRead);

// @route   PUT /api/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.put('/:id/read', markAsRead);

// @route   DELETE /api/notifications/:id
// @desc    Delete notification
// @access  Private
router.delete('/:id', deleteNotification);

// =============================================================================
// PREFERENCE ROUTES
// =============================================================================

// @route   GET /api/notifications/preferences
// @desc    Get notification preferences
// @access  Private
router.get('/preferences', getPreferences);

// @route   PUT /api/notifications/preferences
// @desc    Update preferences
// @access  Private
router.put('/preferences', updatePreferences);

// =============================================================================
// CHAT ROUTES
// =============================================================================

// @route   GET /api/notifications/chat
// @desc    Get chat rooms
// @access  Private
router.get('/chat', getChatRooms);

// @route   GET /api/notifications/chat/:receiverId
// @desc    Get chat history
// @access  Private
router.get('/chat/:receiverId', getChatHistory);

// @route   POST /api/notifications/chat
// @desc    Send chat message
// @access  Private
router.post('/chat', sendChatMessage);

// =============================================================================
// ADMIN ROUTES
// =============================================================================

// @route   POST /api/notifications
// @desc    Create notification (admin)
// @access  Private/Admin
router.post('/', authorize('ADMIN'), createNotification);

// @route   POST /api/notifications/bulk
// @desc    Send bulk notifications
// @access  Private/Admin
router.post('/bulk', authorize('ADMIN'), sendBulkNotifications);

module.exports = router;
