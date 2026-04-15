const express = require('express');
const router = express.Router();
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
      params = [user.id];
    } else if (user.role === 'ketua_tester') {
      appWhere = 'a.ketua_tester_id = ?';
      bugWhere = 'a.ketua_tester_id = ?';
      params = [user.id];
    } else if (user.role === 'tester') {
      bugWhere = 'b.tester_id = ?';
      appWhere = 'EXISTS (SELECT 1 FROM testing_assignments ta WHERE ta.application_id = a.id AND ta.tester_id = ?)';
      params = [user.id];
    } else if (user.role === 'business_analyst' || user.role === 'ba') {
      appWhere = 'EXISTS (SELECT 1 FROM ba_assignments baa WHERE baa.application_id = a.id AND baa.ba_id = ?)';
      bugWhere = 'EXISTS (SELECT 1 FROM ba_assignments baa WHERE baa.application_id = b.application_id AND baa.ba_id = ?)';
      params = [user.id];
    } else if (['programmer', 'dsi'].includes(user.role)) {
      bugWhere = 'b.assigned_to = ?';
      appWhere = 'EXISTS (SELECT 1 FROM bugs b2 WHERE b2.application_id = a.id AND b2.assigned_to = ?)';
      params = [user.id];
    }

    
    const [[bugStats]] = await db.query(`
      SELECT COUNT(*) AS total,
        CAST(SUM(b.status='open') AS UNSIGNED) AS open, 
        CAST(SUM(b.status='in_progress') AS UNSIGNED) AS in_progress,
        CAST(SUM(b.status='fixed') AS UNSIGNED) AS fixed, 
        CAST(SUM(b.status='verified' OR b.status='closed') AS UNSIGNED) AS verified
      FROM bugs b
      LEFT JOIN applications a ON b.application_id = a.id
      WHERE ${bugWhere}`, params);

  
    const [[appStats]] = await db.query(`
      SELECT COUNT(*) AS total, 
             CAST(SUM(a.status='pending') AS UNSIGNED) AS pending,
             CAST(SUM(a.status='testing') AS UNSIGNED) AS testing, 
             CAST(SUM(a.status='selesai') AS UNSIGNED) AS selesai
      FROM applications a
      WHERE ${appWhere}`, params);

    const [recentBugs] = await db.query(`
      SELECT b.*, a.nama_aplikasi, u.nama AS tester_nama FROM bugs b
      LEFT JOIN applications a ON b.application_id = a.id
      LEFT JOIN users u ON b.tester_id = u.id
      WHERE ${bugWhere}
      ORDER BY b.created_at DESC LIMIT 5`, params);

    const [recentApps] = await db.query(`
      SELECT a.*, u.nama AS leader_nama FROM applications a
      LEFT JOIN users u ON a.tim_leader_id = u.id
      WHERE ${appWhere}
      ORDER BY a.created_at DESC LIMIT 5`, params);

    res.render('dashboard/index', {
      title: 'Dashboard',
      bugStats: bugStats || {},
      appStats: appStats || {},
      recentBugs,
      recentApps
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Gagal memuat dashboard.');
    res.redirect('/auth/login');
  }
});

module.exports = router;
