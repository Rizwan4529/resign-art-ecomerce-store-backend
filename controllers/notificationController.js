// =============================================================================
// NOTIFICATION CONTROLLER - Notification & Communication Management
// =============================================================================
// 
// Based on Section 5.12 (Notification & Communication Management):
// - 5.12.1 SMS Notifications (SRS-104, 105)
// - 5.12.2 Push Notifications (SRS-106, 107)
// - 5.12.3 Live Chat (SRS-108, 109, 110)
//
// =============================================================================

const { prisma } = require('../config/db');
const { asyncHandler } = require('../middleware/errorMiddleware');

// =============================================================================
// @desc    Get user's notifications
// @route   GET /api/notifications
// @access  Private
// =============================================================================

const getNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, unreadOnly = false } = req.query;

  const where = { userId: req.user.id };
  
  if (unreadOnly === 'true') {
    where.isRead = false;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const [notifications, totalCount, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      skip,
      take,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: { userId: req.user.id, isRead: false },
    }),
  ]);

  res.status(200).json({
    success: true,
    data: notifications,
    unreadCount,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / take),
      totalCount,
    },
  });
});

// =============================================================================
// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
// =============================================================================

const markAsRead = asyncHandler(async (req, res) => {
  const notificationId = parseInt(req.params.id);

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    res.status(404);
    throw new Error('Notification not found');
  }

  if (notification.userId !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized');
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  res.status(200).json({
    success: true,
    data: updated,
  });
});

// =============================================================================
// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
// =============================================================================

const markAllAsRead = asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({
    where: {
      userId: req.user.id,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  res.status(200).json({
    success: true,
    message: 'All notifications marked as read',
  });
});

// =============================================================================
// @desc    Delete a notification
// @route   DELETE /api/notifications/:id
// @access  Private
// =============================================================================

const deleteNotification = asyncHandler(async (req, res) => {
  const notificationId = parseInt(req.params.id);

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    res.status(404);
    throw new Error('Notification not found');
  }

  if (notification.userId !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized');
  }

  await prisma.notification.delete({
    where: { id: notificationId },
  });

  res.status(200).json({
    success: true,
    message: 'Notification deleted',
  });
});

// =============================================================================
// @desc    Create notification (Admin/System)
// @route   POST /api/notifications
// @access  Private/Admin
// =============================================================================
// Based on SRS-104, SRS-106: Send notifications

const createNotification = asyncHandler(async (req, res) => {
  const { userId, type, title, message, relatedTo } = req.body;

  if (!userId || !type || !title || !message) {
    res.status(400);
    throw new Error('User ID, type, title, and message are required');
  }

  const notification = await prisma.notification.create({
    data: {
      userId: parseInt(userId),
      type,
      title,
      message,
      relatedTo: relatedTo || null,
    },
  });

  res.status(201).json({
    success: true,
    message: 'Notification sent successfully',
    data: notification,
  });
});

// =============================================================================
// @desc    Send bulk notifications (Admin)
// @route   POST /api/notifications/bulk
// @access  Private/Admin
// =============================================================================

const sendBulkNotifications = asyncHandler(async (req, res) => {
  const { userIds, type, title, message, sendToAll = false } = req.body;

  if (!type || !title || !message) {
    res.status(400);
    throw new Error('Type, title, and message are required');
  }

  let targetUserIds = userIds;

  if (sendToAll) {
    const users = await prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    targetUserIds = users.map(u => u.id);
  }

  if (!targetUserIds || targetUserIds.length === 0) {
    res.status(400);
    throw new Error('No users to notify');
  }

  const notifications = await prisma.notification.createMany({
    data: targetUserIds.map(userId => ({
      userId,
      type,
      title,
      message,
    })),
  });

  res.status(201).json({
    success: true,
    message: `Sent ${notifications.count} notifications`,
    count: notifications.count,
  });
});

// =============================================================================
// @desc    Get user preferences
// @route   GET /api/notifications/preferences
// @access  Private
// =============================================================================
// Based on SRS-107: Users can turn on/off notifications

const getPreferences = asyncHandler(async (req, res) => {
  let preferences = await prisma.userPreference.findUnique({
    where: { userId: req.user.id },
  });

  // Create default preferences if not exists
  if (!preferences) {
    preferences = await prisma.userPreference.create({
      data: { userId: req.user.id },
    });
  }

  res.status(200).json({
    success: true,
    data: preferences,
  });
});

// =============================================================================
// @desc    Update user preferences
// @route   PUT /api/notifications/preferences
// @access  Private
// =============================================================================

const updatePreferences = asyncHandler(async (req, res) => {
  const {
    smsNotifications,
    pushNotifications,
    emailNotifications,
    orderUpdates,
    promotions,
  } = req.body;

  const updateData = {};
  if (smsNotifications !== undefined) updateData.smsNotifications = smsNotifications;
  if (pushNotifications !== undefined) updateData.pushNotifications = pushNotifications;
  if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications;
  if (orderUpdates !== undefined) updateData.orderUpdates = orderUpdates;
  if (promotions !== undefined) updateData.promotions = promotions;

  const preferences = await prisma.userPreference.upsert({
    where: { userId: req.user.id },
    update: updateData,
    create: {
      userId: req.user.id,
      ...updateData,
    },
  });

  res.status(200).json({
    success: true,
    message: 'Preferences updated successfully (SRS-107)',
    data: preferences,
  });
});

// =============================================================================
// CHAT FUNCTIONALITY (Section 5.12.3)
// =============================================================================

// @desc    Send chat message
// @route   POST /api/notifications/chat
// @access  Private
// Based on SRS-108, SRS-110

const sendChatMessage = asyncHandler(async (req, res) => {
  const { receiverId, message, messageType = 'text', fileUrl } = req.body;

  if (!receiverId || !message) {
    res.status(400);
    throw new Error('Receiver ID and message are required');
  }

  const roomId = [req.user.id, parseInt(receiverId)].sort().join('_');

  const chatMessage = await prisma.chatMessage.create({
    data: {
      roomId,
      senderId: req.user.id,
      receiverId: parseInt(receiverId),
      message,
      messageType,
      fileUrl: fileUrl || null,
    },
  });

  res.status(201).json({
    success: true,
    data: chatMessage,
  });
});

// @desc    Get chat history
// @route   GET /api/notifications/chat/:receiverId
// @access  Private
// Based on SRS-109

const getChatHistory = asyncHandler(async (req, res) => {
  const { receiverId } = req.params;
  const { page = 1, limit = 50 } = req.query;

  const roomId = [req.user.id, parseInt(receiverId)].sort().join('_');

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const messages = await prisma.chatMessage.findMany({
    where: { roomId },
    orderBy: { sentAt: 'desc' },
    skip,
    take,
  });

  // Mark messages as read
  await prisma.chatMessage.updateMany({
    where: {
      roomId,
      receiverId: req.user.id,
      isRead: false,
    },
    data: { isRead: true },
  });

  res.status(200).json({
    success: true,
    data: messages.reverse(), // Return in chronological order
  });
});

// @desc    Get chat rooms/conversations
// @route   GET /api/notifications/chat
// @access  Private

const getChatRooms = asyncHandler(async (req, res) => {
  // Get distinct room IDs for this user
  const sentMessages = await prisma.chatMessage.findMany({
    where: { senderId: req.user.id },
    distinct: ['roomId'],
    select: { roomId: true, receiverId: true },
  });

  const receivedMessages = await prisma.chatMessage.findMany({
    where: { receiverId: req.user.id },
    distinct: ['roomId'],
    select: { roomId: true, senderId: true },
  });

  // Get unique chat partners
  const partnerIds = new Set();
  sentMessages.forEach(m => partnerIds.add(m.receiverId));
  receivedMessages.forEach(m => partnerIds.add(m.senderId));

  // Get partner details and last message
  const conversations = await Promise.all(
    Array.from(partnerIds).map(async (partnerId) => {
      const roomId = [req.user.id, partnerId].sort().join('_');
      
      const [partner, lastMessage, unreadCount] = await Promise.all([
        prisma.user.findUnique({
          where: { id: partnerId },
          select: { id: true, name: true, profileImage: true },
        }),
        prisma.chatMessage.findFirst({
          where: { roomId },
          orderBy: { sentAt: 'desc' },
        }),
        prisma.chatMessage.count({
          where: {
            roomId,
            receiverId: req.user.id,
            isRead: false,
          },
        }),
      ]);

      return {
        roomId,
        partner,
        lastMessage,
        unreadCount,
      };
    })
  );

  // Sort by last message time
  conversations.sort((a, b) => {
    const timeA = a.lastMessage?.sentAt || new Date(0);
    const timeB = b.lastMessage?.sentAt || new Date(0);
    return new Date(timeB) - new Date(timeA);
  });

  res.status(200).json({
    success: true,
    data: conversations,
  });
});

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
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
};
