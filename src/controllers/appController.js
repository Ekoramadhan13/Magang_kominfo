const db = require('../config/database');
const notifHelper = require('../utils/notifHelper');
const fs = require('fs');

const appController = {
  index: async (req, res) => {
    try {
      const user = req.session.user;
      const { nama, versi, status, deadline } = req.query;

      let query = `
        SELECT a.*, u.nama AS leader_nama,
               (SELECT COUNT(*) FROM bugs b WHERE b.application_id = a.id AND b.status NOT IN ('verified','closed','rejected')) as bugs_open,
               (SELECT COUNT(*) FROM bugs b WHERE b.application_id = a.id AND b.status = 'fixed') as bugs_fixed
        FROM applications a
        LEFT JOIN users u ON a.tim_leader_id = u.id
        WHERE 1=1
      `;
      let params = [];

      if (user.role === 'tim_leader') {
        query += ' AND a.tim_leader_id = ?';
        params.push(user.id);
      } else if (user.role === 'business_analyst' || user.role === 'ba') {
        query += ` AND a.id IN (SELECT application_id FROM ba_assignments WHERE ba_id = ?) `;
        params.push(user.id);
      } else if (user.role === 'tester') {
        query += ` AND a.id IN (SELECT application_id FROM testing_assignments WHERE tester_id = ?) `;
        params.push(user.id);
      } else if (user.role === 'programmer' || user.role === 'dsi') {
        query += ` AND a.id IN (SELECT application_id FROM developer_assignments WHERE user_id = ?) `;
        params.push(user.id);
      }
      // ketua_tester sees all

      if (nama) { query += ' AND a.nama_aplikasi LIKE ?'; params.push(`%${nama}%`); }
      if (versi) { query += ' AND a.versi LIKE ?'; params.push(`%${versi}%`); }
      if (status) { query += ' AND a.status = ?'; params.push(status); }
      if (deadline) { query += ' AND DATE(a.tanggal_deadline) = ?'; params.push(deadline); }

      query += ' ORDER BY a.created_at DESC';
      const [apps] = await db.query(query, params);

      const [allNames] = await db.query("SELECT DISTINCT nama_aplikasi FROM applications ORDER BY nama_aplikasi ASC");
      const [allVersions] = await db.query("SELECT DISTINCT versi FROM applications WHERE versi IS NOT NULL ORDER BY versi ASC");

      res.render('applications/index', {
        title: 'Daftar Aplikasi',
        apps, user, query: req.query, allNames, allVersions
      });
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal memuat data aplikasi.');
      res.redirect('/dashboard');
    }
  },

  create: async (req, res) => {
    try {
      const [allBA]  = await db.query("SELECT id, nama FROM users WHERE role = 'business_analyst' AND is_active = 1");
      const [allDev] = await db.query("SELECT id, nama, role FROM users WHERE role IN ('programmer', 'dsi') AND is_active = 1");

      res.render('applications/create', {
        title: 'Tambah Aplikasi',
        allBA, allDev,
        user: req.session.user
      });
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal memuat form tambah aplikasi.');
      res.redirect('/applications');
    }
  },

  store: async (req, res) => {
    try {
      const {
        nama_aplikasi, deskripsi, versi, url, tanggal_deadline,
        use_cases, dev_ids, ba_ids
      } = req.body;

      // Validasi wajib
      if (!nama_aplikasi) {
        req.flash('error', 'Nama aplikasi wajib diisi.');
        return res.redirect('/applications/create');
      }
      if (!deskripsi || deskripsi.trim() === '') {
        req.flash('error', 'Deskripsi aplikasi wajib diisi.');
        return res.redirect('/applications/create');
      }
      if (!tanggal_deadline) {
        req.flash('error', 'Tanggal deadline wajib diisi.');
        return res.redirect('/applications/create');
      }

      const [result] = await db.query(
        'INSERT INTO applications (nama_aplikasi, deskripsi, versi, url, tanggal_deadline, tim_leader_id, tanggal_submit) VALUES (?,?,?,?,?,?,CURDATE())',
        [nama_aplikasi, deskripsi.trim(), versi, url || null, tanggal_deadline, req.session.user.id]
      );
      const appId = result.insertId;

      // Simpan Use Cases
      if (use_cases && Array.isArray(use_cases)) {
        for (const uc of use_cases) {
          if (uc.judul && uc.judul.trim() !== '') {
            if (!uc.deskripsi || uc.deskripsi.trim() === '') {
              req.flash('error', `Deskripsi use case "${uc.judul}" wajib diisi.`);
              // Hapus aplikasi yang baru dibuat karena gagal
              await db.query('DELETE FROM applications WHERE id = ?', [appId]);
              return res.redirect('/applications/create');
            }
            await db.query(
              'INSERT INTO use_cases (application_id, judul, deskripsi, langkah_langkah, expected_result, role) VALUES (?,?,?,?,?,?)',
              [appId, uc.judul.trim(), uc.deskripsi.trim(), uc.langkah_langkah || null, uc.expected_result || null, uc.role || null]
            );
          }
        }
      }

      // Simpan Penugasan Dev (Programmer/DSI) — minimal 1 wajib
      if (!dev_ids || (Array.isArray(dev_ids) && dev_ids.length === 0)) {
        req.flash('error', 'Minimal harus ada 1 Programmer/DSI yang ditugaskan.');
        await db.query('DELETE FROM use_cases WHERE application_id = ?', [appId]);
        await db.query('DELETE FROM applications WHERE id = ?', [appId]);
        return res.redirect('/applications/create');
      }
      const devArr = Array.isArray(dev_ids) ? dev_ids : [dev_ids];
      for (const uid of devArr) {
        if (uid) {
          await db.query(
            "INSERT IGNORE INTO developer_assignments (application_id, user_id, assigned_by) VALUES (?,?,?)",
            [appId, uid, req.session.user.id]
          );
          // Kirim Notifikasi ke Dev
          await notifHelper.send(uid, `Anda ditugaskan sebagai Programmer untuk aplikasi: ${nama_aplikasi}`, `/applications/${appId}`);
        }
      }

      // Simpan Penugasan BA (Wajib)
      if (!ba_ids || (Array.isArray(ba_ids) && ba_ids.length === 0)) {
        req.flash('error', 'Minimal harus ada 1 Business Analyst yang ditugaskan.');
        await db.query('DELETE FROM developer_assignments WHERE application_id = ?', [appId]);
        await db.query('DELETE FROM use_cases WHERE application_id = ?', [appId]);
        await db.query('DELETE FROM applications WHERE id = ?', [appId]);
        return res.redirect('/applications/create');
      }

      const baArr = Array.isArray(ba_ids) ? ba_ids : [ba_ids];
      for (const baId of baArr) {
        if (baId) {
          await db.query(
            "INSERT IGNORE INTO ba_assignments (application_id, ba_id, assigned_by) VALUES (?,?,?)",
            [appId, baId, req.session.user.id]
          );
          // Kirim Notifikasi ke BA
          await notifHelper.send(baId, `Anda ditugaskan sebagai Business Analyst untuk aplikasi: ${nama_aplikasi}`, `/applications/${appId}`);
        }
      }

      req.flash('success', 'Aplikasi berhasil ditambahkan!');
      res.redirect('/applications/' + appId);
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal menyimpan aplikasi.');
      res.redirect('/applications/create');
    }
  },

  show: async (req, res) => {
    try {
      const user = req.session.user;
      const { id } = req.params;

      // Cek akses BA
      if (user.role === 'business_analyst' || user.role === 'ba') {
        const [[isAssigned]] = await db.query(
          'SELECT id FROM ba_assignments WHERE application_id = ? AND ba_id = ?',
          [id, user.id]
        );
        if (!isAssigned) {
          req.flash('error', 'Anda tidak memiliki akses ke aplikasi ini.');
          return res.redirect('/applications');
        }
      }

      // Cek akses programmer/dsi
      if (user.role === 'programmer' || user.role === 'dsi') {
        const [[isAssigned]] = await db.query(
          'SELECT id FROM developer_assignments WHERE application_id = ? AND user_id = ?',
          [id, user.id]
        );
        if (!isAssigned) {
          req.flash('error', 'Anda tidak memiliki akses ke aplikasi ini.');
          return res.redirect('/applications');
        }
      }

      const [[app]] = await db.query(`
        SELECT a.*, u.nama AS leader_nama
        FROM applications a
        LEFT JOIN users u ON a.tim_leader_id = u.id
        WHERE a.id = ?
      `, [id]);

      if (!app) {
        req.flash('error', 'Aplikasi tidak ditemukan.');
        return res.redirect('/applications');
      }

      const [useCases] = await db.query('SELECT * FROM use_cases WHERE application_id = ? ORDER BY id ASC', [id]);
      const [bugs] = await db.query(`
        SELECT b.*, u.nama AS tester_nama, uc.judul AS use_case_judul
        FROM bugs b
        LEFT JOIN users u ON b.tester_id = u.id
        LEFT JOIN use_cases uc ON b.use_case_id = uc.id
        WHERE b.application_id = ? ORDER BY b.created_at DESC
      `, [id]);
      const [testers] = await db.query(`
        SELECT ta.*, u.nama AS tester_nama, u.role FROM testing_assignments ta
        LEFT JOIN users u ON ta.tester_id = u.id WHERE ta.application_id = ?
      `, [id]);
      const [assignedBAs] = await db.query(`
        SELECT baa.*, u.nama AS ba_nama FROM ba_assignments baa
        LEFT JOIN users u ON baa.ba_id = u.id WHERE baa.application_id = ?
      `, [id]);
      const [assignedDevs] = await db.query(`
        SELECT da.*, u.nama AS dev_nama, u.role FROM developer_assignments da
        LEFT JOIN users u ON da.user_id = u.id WHERE da.application_id = ?
      `, [id]);

      const [allTesters] = await db.query("SELECT id, nama FROM users WHERE role = 'tester' AND is_active = 1");

      const [[bugStats]] = await db.query(`
        SELECT COUNT(*) AS total, SUM(status='open') AS open, SUM(status='in_progress') AS in_progress,
               SUM(status='fixed') AS fixed, SUM(status='verified') AS verified, SUM(status='closed') AS closed,
               SUM(status='rejected') AS rejected
        FROM bugs WHERE application_id = ?
      `, [id]);

      // Cek apakah user tester ditugaskan ke app ini
      let isAssignedTester = false;
      if (user.role === 'tester') {
        const [[ta]] = await db.query(
          "SELECT id FROM testing_assignments WHERE application_id = ? AND tester_id = ?",
          [id, user.id]
        );
        isAssignedTester = !!ta;
      }

      const [[ketuaTesterRow]] = await db.query("SELECT nama FROM users WHERE role = 'ketua_tester' LIMIT 1");

      res.render('applications/detail', {
        title: app.nama_aplikasi,
        app, useCases, bugs, testers, assignedBAs, assignedDevs,
        allTesters, bugStats, user, isAssignedTester,
        ketuaTester: ketuaTesterRow ? ketuaTesterRow.nama : '-'
      });
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal memuat detail aplikasi.');
      res.redirect('/applications');
    }
  },

  edit: async (req, res) => {
    try {
      const [[app]] = await db.query('SELECT * FROM applications WHERE id = ?', [req.params.id]);
      if (!app) {
        req.flash('error', 'Aplikasi tidak ditemukan.');
        return res.redirect('/applications');
      }
      res.render('applications/edit', { title: 'Edit Aplikasi', app, user: req.session.user });
    } catch (err) {
      req.flash('error', 'Gagal memuat form edit.');
      res.redirect('/applications');
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { nama_aplikasi, deskripsi, versi, url, tanggal_deadline, status } = req.body;
      await db.query(
        'UPDATE applications SET nama_aplikasi=?, deskripsi=?, versi=?, url=?, tanggal_deadline=?, status=? WHERE id=?',
        [nama_aplikasi, deskripsi, versi, url || null, tanggal_deadline || null, status, id]
      );
      req.flash('success', 'Aplikasi berhasil diupdate!');
      res.redirect('/applications/' + id);
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal mengupdate aplikasi.');
      res.redirect('/applications/' + req.params.id + '/edit');
    }
  },

  destroy: async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.session.user;

      // Hanya Tim Leader pemilik aplikasi atau Admin yang bisa hapus
      if (user.role === 'tim_leader') {
        const [[app]] = await db.query('SELECT tim_leader_id FROM applications WHERE id = ?', [id]);
        if (!app || app.tim_leader_id !== user.id) {
          req.flash('error', 'Anda tidak berhak menghapus aplikasi ini.');
          return res.redirect('/applications');
        }
      }

      await db.query("DELETE FROM bug_history WHERE bug_id IN (SELECT id FROM bugs WHERE application_id = ?)", [id]);
      await db.query("DELETE FROM bugs WHERE application_id = ?", [id]);
      await db.query("DELETE FROM use_cases WHERE application_id = ?", [id]);
      await db.query("DELETE FROM ba_assignments WHERE application_id = ?", [id]);
      await db.query("DELETE FROM developer_assignments WHERE application_id = ?", [id]);
      await db.query("DELETE FROM testing_assignments WHERE application_id = ?", [id]);
      await db.query("DELETE FROM applications WHERE id = ?", [id]);

      req.flash('success', 'Aplikasi dan seluruh data terkait berhasil dihapus.');
      res.redirect('/applications');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal menghapus aplikasi.');
      res.redirect('/applications');
    }
  },

  assignTester: async (req, res) => {
    try {
      const { id } = req.params;
      const { tester_ids } = req.body;

      if (!tester_ids || (Array.isArray(tester_ids) && tester_ids.filter(Boolean).length === 0)) {
        req.flash('error', 'Minimal harus ada 1 tester yang dipilih.');
        return res.redirect('/applications/' + id);
      }

      const [[app]] = await db.query("SELECT nama_aplikasi FROM applications WHERE id = ?", [id]);
      const ids = Array.isArray(tester_ids) ? tester_ids : [tester_ids];
      for (const tid of ids) {
        if (tid) {
          await db.query(
            "INSERT INTO testing_assignments (application_id, tester_id, assigned_by, status) VALUES (?,?,?,'pending') ON DUPLICATE KEY UPDATE status='pending'",
            [id, tid, req.session.user.id]
          );
          // Kirim Notifikasi
          await notifHelper.send(tid, `Anda ditugaskan sebagai Tester untuk aplikasi: ${app.nama_aplikasi}`, `/applications/${id}`);
        }
      }

      req.flash('success', 'Tester berhasil ditugaskan!');
      res.redirect('/applications/' + id);
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal menugaskan tester.');
      res.redirect('/applications/' + req.params.id);
    }
  },

  assignBA: async (req, res) => {
    try {
      const { id } = req.params;
      const { ba_ids } = req.body;

      if (ba_ids) {
        const [[app]] = await db.query("SELECT nama_aplikasi FROM applications WHERE id = ?", [id]);
        const ids = Array.isArray(ba_ids) ? ba_ids : [ba_ids];
        for (const baId of ids) {
          if (baId) {
            await db.query(
              "INSERT IGNORE INTO ba_assignments (application_id, ba_id, assigned_by) VALUES (?,?,?)",
              [id, baId, req.session.user.id]
            );
            // Kirim Notifikasi
            await notifHelper.send(baId, `Anda ditugaskan sebagai Business Analyst untuk aplikasi: ${app.nama_aplikasi}`, `/applications/${id}`);
          }
        }
      }
      req.flash('success', 'Business Analyst berhasil ditugaskan!');
      res.redirect('/applications/' + id);
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal menugaskan Business Analyst.');
      res.redirect('/applications/' + req.params.id);
    }
  },

  startTesting: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.user.id;

      await db.query(
        "UPDATE testing_assignments SET status = 'on_going' WHERE application_id = ? AND tester_id = ?",
        [id, userId]
      );
      await db.query(
        "UPDATE applications SET status = 'testing' WHERE id = ? AND status = 'pending'",
        [id]
      );

      req.flash('success', 'Selamat bekerja! Status penugasan Anda sekarang On Progress.');
      res.redirect('/applications/' + id);
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal memulai penugasan.');
      res.redirect('/applications/' + req.params.id);
    }
  },

  finishTesting: async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.session.user;

      // Set testing_finished = 1 untuk aplikasi ini
      await db.query(
        "UPDATE applications SET testing_finished = 1, status = 'selesai' WHERE id = ?",
        [id]
      );

      // Update semua assignment tester jadi done
      await db.query(
        "UPDATE testing_assignments SET status = 'done' WHERE application_id = ?",
        [id]
      );

      req.flash('success', 'Testing telah dinyatakan Selesai! Programmer/DSI tidak dapat mengerjakan task lagi.');
      res.redirect('/applications/' + id);
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal memproses penyelesaian testing.');
      res.redirect('/applications/' + req.params.id);
    }
  },

  finishAppTesting: async (req, res) => {
    try {
      const { id } = req.params;

      await db.query(
        "UPDATE applications SET testing_finished = 1, status = 'selesai' WHERE id = ?",
        [id]
      );
      await db.query("UPDATE testing_assignments SET status = 'done' WHERE application_id = ?", [id]);

      req.flash('success', 'Seluruh pengujian aplikasi telah dinyatakan Selesai!');
      res.redirect('/applications/' + id);
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal memproses penyelesaian aplikasi.');
      res.redirect('/applications/' + req.params.id);
    }
  }
};

module.exports = appController;