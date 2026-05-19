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
  },

  /**
   * Get unified active tasks and unread notifications for a user
   * @param {Object} user - The user object from session
   */
  getCombinedTasksAndNotifs: async (user) => {
    if (!user) return [];
    
    try {
      let pendingTaskDetails = [];

      if (user.role === 'tester') {
        // Aplikasi baru ditugaskan (belum mulai / pending)
        const [pendingApps] = await db.query(`
          SELECT a.id, a.nama_aplikasi, a.created_at
          FROM testing_assignments ta
          JOIN applications a ON ta.application_id = a.id
          WHERE ta.tester_id = ? AND ta.status = 'pending'
        `, [user.id]);
        
        // Bug yang sudah Fixed → perlu diverifikasi oleh tester pemilik bug
        const [fixedBugs] = await db.query(`
          SELECT id, judul, created_at FROM bugs WHERE tester_id = ? AND status = 'fixed'
        `, [user.id]);

        pendingTaskDetails = [
          ...pendingApps.map(p => ({ 
            message: `Tugas Baru: Uji aplikasi ${p.nama_aplikasi}`, 
            link: `/applications/${p.id}`, 
            created_at: p.created_at 
          })),
          ...fixedBugs.map(b => ({ 
            message: `Review Fix: ${b.judul}`, 
            link: `/bugs/${b.id}`, 
            created_at: b.created_at 
          }))
        ];

      } else if (user.role === 'ketua_tester') {
        // Aplikasi aktif yang belum ada tester ditugaskan
        const [pendingApps] = await db.query(`
          SELECT id, nama_aplikasi, created_at FROM applications
          WHERE status != 'selesai' AND (testing_finished IS NULL OR testing_finished = 0)
          AND id NOT IN (SELECT application_id FROM testing_assignments)
        `);
        
        // Bug Fixed → perlu direview ketua tester
        const [fixedBugs] = await db.query(`
          SELECT id, judul, created_at FROM bugs WHERE status = 'fixed'
        `);

        pendingTaskDetails = [
          ...pendingApps.map(p => ({ 
            message: `Tugaskan Tester: ${p.nama_aplikasi}`, 
            link: `/applications/${p.id}`, 
            created_at: p.created_at 
          })),
          ...fixedBugs.map(b => ({ 
            message: `Review Fix: ${b.judul}`, 
            link: `/bugs/${b.id}`, 
            created_at: b.created_at 
          }))
        ];

      } else if (['programmer', 'dsi'].includes(user.role)) {
        // Bug open atau in_progress atau rejected pada aplikasi yang ditugaskan kepadanya yang belum ia kerjakan
        const [bugs] = await db.query(`
          SELECT b.id, b.judul, b.created_at
          FROM bugs b
          JOIN developer_assignments da ON b.application_id = da.application_id
          WHERE da.user_id = ? 
            AND b.status IN ('open', 'in_progress', 'rejected')
            AND b.id NOT IN (SELECT bug_id FROM bug_contributors WHERE user_id = ?)
        `, [user.id, user.id]);
        
        pendingTaskDetails = bugs.map(b => ({ 
          message: `Perlu Dikerjakan: ${b.judul}`, 
          link: `/bugs/${b.id}`, 
          created_at: b.created_at 
        }));

      } else if (user.role === 'tim_leader') {
        // Aplikasi yang belum ada developer ditugaskan
        const [pending] = await db.query(`
          SELECT id, nama_aplikasi, created_at FROM applications
          WHERE tim_leader_id = ? AND status = 'pending'
          AND id NOT IN (SELECT application_id FROM developer_assignments)
        `, [user.id]);
        
        pendingTaskDetails = pending.map(p => ({ 
          message: `Setup Dev: ${p.nama_aplikasi}`, 
          link: `/applications/${p.id}`, 
          created_at: p.created_at 
        }));
      }

      // Ambil Notifikasi yang belum dibaca dari tabel notifications
      const [unreadNotifs] = await db.query(`
        SELECT id, message, link, created_at FROM notifications 
        WHERE user_id = ? AND is_read = 0 
        ORDER BY created_at DESC
      `, [user.id]);

      // Gabungkan dan filter duplikasi berdasarkan link
      const combined = [...pendingTaskDetails];
      unreadNotifs.forEach(n => {
        const exists = combined.some(t => t.link === n.link);
        if (!exists) {
          combined.push({
            id: n.id,
            message: n.message,
            link: `/notifications/${n.id}/read`,
            created_at: n.created_at
          });
        }
      });

      // Urutkan berdasarkan created_at desc (terbaru di atas)
      combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      return combined;
    } catch (err) {
      console.error('Error combining tasks and notifications:', err);
      return [];
    }
  }
};

module.exports = notifHelper;
