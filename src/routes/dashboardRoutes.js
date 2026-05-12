const express = require('express');
const router  = express.Router();
const { isAuthenticated } = require('../middleware/authMiddleware');
const db = require('../config/database');

router.get('/', isAuthenticated, async (req, res) => {
  try {
    const user = req.session.user;
    let bugWhere = '1=1';
    let appWhere = '1=1';
    let params = [];

    if (user.role === 'tim_leader') {
      appWhere = 'a.tim_leader_id = ?';
      bugWhere = 'a.tim_leader_id = ?';
      params   = [user.id];
    } else if (user.role === 'ketua_tester') {
      appWhere = '1=1'; bugWhere = '1=1'; params = [];
    } else if (user.role === 'tester') {
      bugWhere = 'b.tester_id = ?';
      appWhere = 'EXISTS (SELECT 1 FROM testing_assignments ta WHERE ta.application_id = a.id AND ta.tester_id = ?)';
      params   = [user.id];
    } else if (user.role === 'business_analyst' || user.role === 'ba') {
      appWhere = 'EXISTS (SELECT 1 FROM ba_assignments baa WHERE baa.application_id = a.id AND baa.ba_id = ?)';
      bugWhere = 'EXISTS (SELECT 1 FROM ba_assignments baa WHERE baa.application_id = b.application_id AND baa.ba_id = ?)';
      params   = [user.id];
    } else if (['programmer', 'dsi'].includes(user.role)) {
      appWhere = 'EXISTS (SELECT 1 FROM developer_assignments da WHERE da.application_id = a.id AND da.user_id = ?)';
      bugWhere = 'EXISTS (SELECT 1 FROM developer_assignments da WHERE da.application_id = b.application_id AND da.user_id = ?)';
      params   = [user.id];
    }

    // ── Notifikasi per role ─────────────────────────────────────────────────
    let pendingTaskDetails = [];

    if (user.role === 'tester') {
      // Aplikasi baru ditugaskan (belum mulai)
      const [pendingApps] = await db.query(`
        SELECT a.id, a.nama_aplikasi
        FROM testing_assignments ta
        JOIN applications a ON ta.application_id = a.id
        WHERE ta.tester_id = ? AND ta.status = 'pending'
      `, [user.id]);
      // Bug yang sudah Fixed → perlu diverifikasi
      const [fixedBugs] = await db.query(`
        SELECT id, judul FROM bugs WHERE tester_id = ? AND status = 'fixed'
      `, [user.id]);

      pendingTaskDetails = [
        ...pendingApps.map(p => ({ id: p.id, title: p.nama_aplikasi, type: 'app', link: `/applications/${p.id}` })),
        ...fixedBugs.map(b  => ({ id: b.id, title: `Review Fix: ${b.judul}`, type: 'bug', link: `/bugs/${b.id}` }))
      ];

    } else if (user.role === 'ketua_tester') {
      // Aplikasi aktif yang belum ada tester
      const [pendingApps] = await db.query(`
        SELECT id, nama_aplikasi FROM applications
        WHERE status != 'selesai' AND (testing_finished IS NULL OR testing_finished = 0)
        AND id NOT IN (SELECT application_id FROM testing_assignments)
      `);
      // Bug Fixed → perlu direview
      const [fixedBugs] = await db.query(`
        SELECT id, judul FROM bugs WHERE status = 'fixed'
      `);

      pendingTaskDetails = [
        ...pendingApps.map(p => ({ id: p.id, title: `Tugaskan Tester: ${p.nama_aplikasi}`, type: 'app', link: `/applications/${p.id}` })),
        ...fixedBugs.map(b  => ({ id: b.id, title: `Review Fix: ${b.judul}`, type: 'bug', link: `/bugs/${b.id}` }))
      ];

    } else if (['programmer', 'dsi'].includes(user.role)) {
      // Bug open atau in_progress yang belum dikerjakan olehnya
      const [bugs] = await db.query(`
        SELECT b.id, b.judul
        FROM bugs b
        JOIN developer_assignments da ON b.application_id = da.application_id
        WHERE da.user_id = ? 
          AND b.status IN ('open', 'in_progress', 'rejected')
          AND b.id NOT IN (SELECT bug_id FROM bug_contributors WHERE user_id = ?)
      `, [user.id, user.id]);
      pendingTaskDetails = bugs.map(b => ({ id: b.id, title: b.judul, type: 'bug', link: `/bugs/${b.id}` }));

    } else if (user.role === 'tim_leader') {
      // Aplikasi yang belum ada developer ditugaskan
      const [pending] = await db.query(`
        SELECT id, nama_aplikasi FROM applications
        WHERE tim_leader_id = ? AND status = 'pending'
        AND id NOT IN (SELECT application_id FROM developer_assignments)
      `, [user.id]);
      pendingTaskDetails = pending.map(p => ({ id: p.id, title: `Setup Dev: ${p.nama_aplikasi}`, type: 'app', link: `/applications/${p.id}` }));
    }

    // ── Tambahkan Notifikasi yang belum dibaca sebagai tugas ───────────────
    const [unreadNotifs] = await db.query(`
      SELECT id, message, link FROM notifications WHERE user_id = ? AND is_read = 0
    `, [user.id]);

    unreadNotifs.forEach(n => {
      // Cek apakah sudah ada tugas dengan link yang sama
      const exists = pendingTaskDetails.some(t => t.link === n.link);
      if (!exists) {
        pendingTaskDetails.push({
          id: n.id,
          title: n.message,
          type: 'notif',
          link: n.link,
          notifId: n.id // simpan id notif untuk ditandai sebagai dibaca nanti
        });
      }
    });

    const pendingTasksCount = pendingTaskDetails.length;

    // ── Statistik Bug ───────────────────────────────────────────────────────
    const [[bugStats]] = await db.query(`
      SELECT COUNT(*) AS total,
        CAST(SUM(b.status='open')        AS UNSIGNED) AS open,
        CAST(SUM(b.status='in_progress') AS UNSIGNED) AS in_progress,
        CAST(SUM(b.status='fixed')       AS UNSIGNED) AS fixed,
        CAST(SUM(b.status='verified')    AS UNSIGNED) AS verified,
        CAST(SUM(b.status='closed')      AS UNSIGNED) AS closed,
        CAST(SUM(b.status='rejected')    AS UNSIGNED) AS rejected
      FROM bugs b
      LEFT JOIN applications a ON b.application_id = a.id
      WHERE ${bugWhere}`, params);

    // ── Statistik Aplikasi ──────────────────────────────────────────────────
    const [[appStats]] = await db.query(`
      SELECT COUNT(*) AS total,
             CAST(SUM(a.status='pending') AS UNSIGNED) AS pending,
             CAST(SUM(a.status='testing') AS UNSIGNED) AS testing,
             CAST(SUM(a.status='selesai') AS UNSIGNED) AS selesai
      FROM applications a
      WHERE ${appWhere}`, params);

    // ── Bug Terbaru (aktif) ─────────────────────────────────────────────────
    const [recentBugs] = await db.query(`
      SELECT b.id, b.judul, b.status, b.severity, b.created_at,
             a.nama_aplikasi, u.nama AS tester_nama, uc.judul AS use_case_judul
      FROM bugs b
      LEFT JOIN applications a ON b.application_id = a.id
      LEFT JOIN users u ON b.tester_id = u.id
      LEFT JOIN use_cases uc ON b.use_case_id = uc.id
      WHERE ${bugWhere} AND b.status IN ('open','in_progress','fixed')
      ORDER BY b.created_at DESC LIMIT 5`, params);

    // ── Bug Lama (selesai) ──────────────────────────────────────────────────
    const [oldBugs] = await db.query(`
      SELECT b.id, b.judul, b.status, b.severity, b.created_at,
             a.nama_aplikasi, u.nama AS tester_nama, uc.judul AS use_case_judul
      FROM bugs b
      LEFT JOIN applications a ON b.application_id = a.id
      LEFT JOIN users u ON b.tester_id = u.id
      LEFT JOIN use_cases uc ON b.use_case_id = uc.id
      WHERE ${bugWhere} AND b.status IN ('verified','closed','rejected')
      ORDER BY b.created_at DESC LIMIT 5`, params);

    // ── Aplikasi Terbaru (aktif, deadline belum lewat) ─────────────────────
    const [recentApps] = await db.query(`
      SELECT a.*, u.nama AS leader_nama FROM applications a
      LEFT JOIN users u ON a.tim_leader_id = u.id
      WHERE ${appWhere} AND a.status != 'selesai'
        AND (a.tanggal_deadline IS NULL OR a.tanggal_deadline >= CURDATE())
      ORDER BY a.created_at DESC LIMIT 5`, params);

    // ── Aplikasi Lama (selesai atau deadline lewat) ─────────────────────────
    const [oldApps] = await db.query(`
      SELECT a.*, u.nama AS leader_nama FROM applications a
      LEFT JOIN users u ON a.tim_leader_id = u.id
      WHERE ${appWhere} AND (a.status = 'selesai' OR a.tanggal_deadline < CURDATE())
      ORDER BY a.created_at DESC LIMIT 5`, params);

    res.render('dashboard/index', {
      title: 'Dashboard',
      bugStats:  bugStats  || {},
      appStats:  appStats  || {},
      recentBugs, oldBugs,
      recentApps, oldApps,
      pendingTaskDetails,
      pendingTasksCount
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Gagal memuat dashboard.');
    res.redirect('/auth/login');
  }
});

module.exports = router;
