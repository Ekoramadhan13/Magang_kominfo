const db = require('../config/database');

const appController = {
  index: async (req, res) => {
    try {
      const [apps] = await db.query(`
        SELECT a.*, u.nama AS leader_nama, kt.nama AS ketua_tester_nama,
               COUNT(DISTINCT b.id) AS total_bugs,
               SUM(b.status = 'open') AS bugs_open,
               SUM(b.status = 'fixed') AS bugs_fixed,
               COUNT(DISTINCT ta.tester_id) AS total_tester
        FROM applications a
        LEFT JOIN users u ON a.tim_leader_id = u.id
        LEFT JOIN users kt ON a.ketua_tester_id = kt.id
        LEFT JOIN bugs b ON a.id = b.application_id
        LEFT JOIN testing_assignments ta ON a.id = ta.application_id
        GROUP BY a.id ORDER BY a.created_at DESC
      `);
      res.render('applications/index', { title: 'Daftar Aplikasi', apps });
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal memuat data aplikasi.');
      res.redirect('/dashboard');
    }
  },

  create: (req, res) => {
    res.render('applications/create', { title: 'Tambah Aplikasi' });
  },

  store: async (req, res) => {
    try {
      const { nama_aplikasi, deskripsi, versi, tanggal_deadline } = req.body;
      if (!nama_aplikasi) {
        req.flash('error', 'Nama aplikasi wajib diisi.');
        return res.redirect('/applications/create');
      }
      await db.query(
        'INSERT INTO applications (nama_aplikasi, deskripsi, versi, tanggal_deadline, tim_leader_id, tanggal_submit) VALUES (?,?,?,?,?,CURDATE())',
        [nama_aplikasi, deskripsi, versi, tanggal_deadline || null, req.session.user.id]
      );
      req.flash('success', 'Aplikasi berhasil ditambahkan!');
      res.redirect('/applications');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal menyimpan aplikasi.');
      res.redirect('/applications/create');
    }
  },

  show: async (req, res) => {
    try {
      const { id } = req.params;
      const [[app]] = await db.query(`
        SELECT a.*, u.nama AS leader_nama, kt.nama AS ketua_tester_nama
        FROM applications a
        LEFT JOIN users u ON a.tim_leader_id = u.id
        LEFT JOIN users kt ON a.ketua_tester_id = kt.id
        WHERE a.id = ?
      `, [id]);

      if (!app) { req.flash('error', 'Aplikasi tidak ditemukan.'); return res.redirect('/applications'); }

      const [useCases] = await db.query('SELECT * FROM use_cases WHERE application_id = ? ORDER BY id ASC', [id]);
      const [bugs] = await db.query(`
        SELECT b.*, u.nama AS tester_nama FROM bugs b
        LEFT JOIN users u ON b.tester_id = u.id
        WHERE b.application_id = ? ORDER BY b.created_at DESC
      `, [id]);
      const [testers] = await db.query(`
        SELECT ta.*, u.nama AS tester_nama FROM testing_assignments ta
        LEFT JOIN users u ON ta.tester_id = u.id WHERE ta.application_id = ?
      `, [id]);
      const [allTesters] = await db.query("SELECT id, nama FROM users WHERE role = 'tester' AND is_active = 1");
      const [allKetua] = await db.query("SELECT id, nama FROM users WHERE role = 'ketua_tester' AND is_active = 1");

      const [[bugStats]] = await db.query(`
        SELECT COUNT(*) AS total, SUM(status='open') AS open, SUM(status='in_progress') AS in_progress,
               SUM(status='fixed') AS fixed, SUM(status='verified') AS verified, SUM(status='closed') AS closed
        FROM bugs WHERE application_id = ?
      `, [id]);

      res.render('applications/detail', { title: app.nama_aplikasi, app, useCases, bugs, testers, allTesters, allKetua, bugStats });
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal memuat detail aplikasi.');
      res.redirect('/applications');
    }
  },

  edit: async (req, res) => {
    try {
      const [[app]] = await db.query('SELECT * FROM applications WHERE id = ?', [req.params.id]);
      if (!app) { req.flash('error', 'Aplikasi tidak ditemukan.'); return res.redirect('/applications'); }
      res.render('applications/edit', { title: 'Edit Aplikasi', app });
    } catch (err) {
      req.flash('error', 'Gagal memuat form edit.'); res.redirect('/applications');
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { nama_aplikasi, deskripsi, versi, tanggal_deadline, status } = req.body;
      await db.query(
        'UPDATE applications SET nama_aplikasi=?, deskripsi=?, versi=?, tanggal_deadline=?, status=? WHERE id=?',
        [nama_aplikasi, deskripsi, versi, tanggal_deadline || null, status, id]
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
      await db.query('DELETE FROM applications WHERE id = ?', [req.params.id]);
      req.flash('success', 'Aplikasi berhasil dihapus.');
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
      const { ketua_tester_id, tester_ids } = req.body;
      if (ketua_tester_id) {
        await db.query("UPDATE applications SET ketua_tester_id=?, status='testing' WHERE id=?", [ketua_tester_id, id]);
      }
      if (tester_ids) {
        const ids = Array.isArray(tester_ids) ? tester_ids : [tester_ids];
        for (const tid of ids) {
          await db.query(
            "INSERT INTO testing_assignments (application_id, tester_id, assigned_by, status) VALUES (?,?,?,'on_going') ON DUPLICATE KEY UPDATE status='on_going'",
            [id, tid, req.session.user.id]
          );
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

  storeUseCase: async (req, res) => {
    try {
      const { application_id, judul, deskripsi, langkah_langkah, expected_result } = req.body;
      await db.query(
        'INSERT INTO use_cases (application_id, judul, deskripsi, langkah_langkah, expected_result) VALUES (?,?,?,?,?)',
        [application_id, judul, deskripsi, langkah_langkah, expected_result]
      );
      req.flash('success', 'Use case berhasil ditambahkan!');
      res.redirect('/applications/' + application_id);
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal menyimpan use case.');
      res.redirect('/applications/' + req.body.application_id);
    }
  }
};

module.exports = appController;