const db = require('../config/database');

const notifHelper = {
  /**
   * Send notification to a specific user
   * @param {number} userId - Recipient ID
   * @param {string} message - Notification message
   * @param {string} link - Optional link
   */
  send: async (userId, message, link = null) => {
    try {
      await db.query(
        'INSERT INTO notifications (user_id, message, link) VALUES (?, ?, ?)',
        [userId, message, link]
      );
      return true;
    } catch (err) {
      console.error('Error sending notification:', err);
      return false;
    }
  },

  /**
   * Get unread notifications for a user
   * @param {number} userId 
   */
  getUnread: async (userId) => {
    try {
      const [rows] = await db.query(
        'SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC',
        [userId]
      );
      return rows;
    } catch (err) {
      console.error('Error fetching unread notifications:', err);
      return [];
    }
  },

  /**
   * Mark notification as read
   */
  markAsRead: async (notifId) => {
    try {
      await db.query('UPDATE notifications SET is_read = 1 WHERE id = ?', [notifId]);
      return true;
    } catch (err) {
      return false;
    }
  }
};

module.exports = notifHelper;
