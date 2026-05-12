const db = require('../config/database');
const notifHelper = require('../utils/notifHelper');

const notifController = {
  index: async (req, res) => {
    try {
      const user = req.session.user;
      const [notifications] = await db.query(
        'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
        [user.id]
      );
      res.render('notifications/index', { title: 'Notifikasi', notifications });
    } catch (err) {
      console.error(err);
      res.redirect('/dashboard');
    }
  },

  read: async (req, res) => {
    try {
      const { id } = req.params;
      const [[notif]] = await db.query('SELECT * FROM notifications WHERE id = ?', [id]);
      
      if (notif && notif.user_id === req.session.user.id) {
        await notifHelper.markAsRead(id);
        if (notif.link) return res.redirect(notif.link);
      }
      res.redirect('/dashboard');
    } catch (err) {
      console.error(err);
      res.redirect('/dashboard');
    }
  },

  markAllRead: async (req, res) => {
    try {
      await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.session.user.id]);
      req.flash('success', 'Semua notifikasi ditandai sebagai dibaca.');
      res.redirect('/notifications');
    } catch (err) {
      console.error(err);
      res.redirect('/notifications');
    }
  }
};

module.exports = notifController;
