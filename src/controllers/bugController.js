const db = require('../config/database');
const multer = require('multer');
const path = require('path');
const notifHelper = require('../utils/notifHelper');

const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, 'public/uploads'); },
  filename: (req, file, cb) => { cb(null, Date.now() + path.extname(file.originalname)); }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const bugController = {
  // ─── Daftar Bug ────────────────────────────────────────────────────────────
  index: async (req, res) => {
    try {
      const user = req.session.user;
      const { status, kategori, start_date, end_date, tester_id, application_id } = req.query;

      let query = `
        SELECT b.*, a.nama_aplikasi, u.nama AS tester_nama,
               uc.judul AS use_case_judul,
               (SELECT COUNT(*) FROM bug_history bh WHERE bh.bug_id = b.id AND bh.keterangan LIKE 'BERHASIL DENGAN CATATAN%') AS is_catatan
        FROM bugs b
        LEFT JOIN applications a ON b.application_id = a.id
        LEFT JOIN users u ON b.tester_id = u.id
        LEFT JOIN use_cases uc ON b.use_case_id = uc.id
        WHERE 1=1 `;
      let params = [];

      // Pembatasan akses per role
      if (user.role === 'tester') {
        query += ' AND b.tester_id = ?';
        params.push(user.id);
      } else if (user.role === 'business_analyst' || user.role === 'ba') {
        query += ' AND b.application_id IN (SELECT application_id FROM ba_assignments WHERE ba_id = ?)';
        params.push(user.id);
      } else if (user.role === 'tim_leader') {
        query += ' AND a.tim_leader_id = ?';
        params.push(user.id);
      } else if (user.role === 'programmer' || user.role === 'dsi') {
        query += ' AND b.application_id IN (SELECT application_id FROM developer_assignments WHERE user_id = ?)';
        params.push(user.id);
      }
      // ketua_tester & admin: lihat semua

      // Filter Kategori (hasil akhir via status)
      if (kategori) {
        if (kategori === 'Berhasil') {
          query += ' AND b.status = "verified"';
        } else if (kategori === 'Gagal') {
          query += ' AND b.status = "rejected" AND b.id NOT IN (SELECT bug_id FROM bug_history WHERE keterangan LIKE "BERHASIL DENGAN CATATAN%")';
        } else if (kategori === 'Berhasil dengan catatan') {
          query += ' AND (b.status = "closed" OR (b.status = "rejected" AND b.id IN (SELECT bug_id FROM bug_history WHERE keterangan LIKE "BERHASIL DENGAN CATATAN%")))';
        }
      }

      // Filter Status
      const validStatuses = ['open', 'in_progress', 'fixed', 'verified', 'rejected', 'closed'];
      if (status && validStatuses.includes(status)) {
        query += ' AND b.status = ?';
        params.push(status);
      }

      if (start_date) { query += ' AND DATE(b.created_at) >= ?'; params.push(start_date); }
      if (end_date) { query += ' AND DATE(b.created_at) <= ?'; params.push(end_date); }
      if (tester_id) { query += ' AND b.tester_id = ?'; params.push(tester_id); }

      // Filter Aplikasi
      if (application_id) {
        query += ' AND b.application_id = ?';
        params.push(application_id);
      }

      query += ' ORDER BY b.created_at DESC';
      const [bugs] = await db.query(query, params);

      // Ambil daftar tester (untuk filter ketua_tester/admin)
      const [allTesters] = await db.query("SELECT id, nama FROM users WHERE role IN ('tester','ketua_tester') AND is_active = 1");

      // Ambil daftar aplikasi untuk filter
      let appQuery = 'SELECT id, nama_aplikasi FROM applications WHERE 1=1';
      let appParams = [];

      if (user.role === 'tester') {
        appQuery = "SELECT a.id, a.nama_aplikasi FROM applications a JOIN testing_assignments ta ON a.id = ta.application_id WHERE ta.tester_id = ?";
        appParams.push(user.id);
      } else if (user.role === 'business_analyst' || user.role === 'ba') {
        appQuery = "SELECT a.id, a.nama_aplikasi FROM applications a JOIN ba_assignments baa ON a.id = baa.application_id WHERE baa.ba_id = ?";
        appParams.push(user.id);
      } else if (user.role === 'programmer' || user.role === 'dsi') {
        appQuery = "SELECT a.id, a.nama_aplikasi FROM applications a JOIN developer_assignments da ON a.id = da.application_id WHERE da.user_id = ?";
        appParams.push(user.id);
      } else if (user.role === 'tim_leader') {
        appQuery += ' AND tim_leader_id = ?';
        appParams.push(user.id);
      }

      const [allApps] = await db.query(appQuery, appParams);

      res.render('bugs/index', {
        title: 'Daftar Bugs',
        bugs,
        user,
        query: req.query,
        allTesters,
        allApps
      });
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal memuat data bugs.');
      res.redirect('/dashboard');
    }
  },

  // ─── Form Laporkan Bug ──────────────────────────────────────────────────────
  create: async (req, res) => {
    try {
      const user = req.session.user;
      let apps = [];

      if (user.role === 'ketua_tester') {
        // Ketua Tester bisa lapor bug untuk semua aplikasi yang aktif
        const [rows] = await db.query("SELECT * FROM applications WHERE status != 'selesai' AND (testing_finished IS NULL OR testing_finished = 0) ORDER BY nama_aplikasi ASC");
        apps = rows;
      } else {
        // Tester: hanya untuk aplikasi yang ditugaskan
        const [rows] = await db.query(`
          SELECT a.* FROM applications a
          JOIN testing_assignments ta ON a.id = ta.application_id
          WHERE ta.tester_id = ? AND ta.status = 'on_going'
        `, [user.id]);
        apps = rows;
      }

      res.render('bugs/create', {
        title: 'Laporkan Bug', apps, user,
        appId: req.query.appId || null
      });
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal memuat form.');
      res.redirect('/bugs');
    }
  },

  // ─── Simpan Bug Baru ────────────────────────────────────────────────────────
  store: [upload.single('screenshot'), async (req, res) => {
    try {
      let {
        application_id, use_case_id, judul, deskripsi,
        langkah_reproduksi, expected_result, actual_result,
        severity, priority
      } = req.body;

      const screenshot = req.file ? req.file.filename : null;
      use_case_id = (use_case_id === '' || !use_case_id) ? null : use_case_id;

      // Bug baru SELALU status 'open'
      await db.query(
        `INSERT INTO bugs (application_id, use_case_id, tester_id,
          judul, deskripsi, langkah_reproduksi, expected_result,
          actual_result, severity, priority, screenshot, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,'open')`,
        [application_id, use_case_id, req.session.user.id,
          judul, deskripsi, langkah_reproduksi, expected_result,
          actual_result, severity, priority, screenshot]
      );

      // Update status aplikasi ke 'testing' jika masih 'pending'
      await db.query(
        "UPDATE applications SET status = 'testing' WHERE id = ? AND status = 'pending'",
        [application_id]
      );

      // Notifikasi ke Programmer
      const [[app]] = await db.query("SELECT nama_aplikasi FROM applications WHERE id = ?", [application_id]);
      const [devs] = await db.query("SELECT user_id FROM developer_assignments WHERE application_id = ?", [application_id]);

      const [insertResult] = await db.query("SELECT LAST_INSERT_ID() as id");
      const bugId = insertResult[0].id;

      for (const dev of devs) {
        await notifHelper.send(
          dev.user_id,
          `Ada bug baru: ${judul} pada aplikasi ${app.nama_aplikasi}`,
          `/bugs/${bugId}`
        );
      }

      req.flash('success', 'Bug berhasil dilaporkan! Status: Open.');
      res.redirect(`/applications/${application_id}`);
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal menyimpan bug.');
      res.redirect('/bugs/create');
    }
  }],

  // ─── Detail Bug ─────────────────────────────────────────────────────────────
  show: async (req, res) => {
    try {
      const { id } = req.params;
      const [[bug]] = await db.query(`
        SELECT b.*, a.nama_aplikasi, a.testing_finished, u.nama AS tester_nama,
               uc.judul AS use_case_judul, p.nama AS programmer_nama,
               (SELECT COUNT(*) FROM bug_history bh WHERE bh.bug_id = b.id AND bh.keterangan LIKE 'BERHASIL DENGAN CATATAN%') AS is_catatan
        FROM bugs b
        LEFT JOIN applications a ON b.application_id = a.id
        LEFT JOIN users u ON b.tester_id = u.id
        LEFT JOIN use_cases uc ON b.use_case_id = uc.id
        LEFT JOIN users p ON b.assigned_to = p.id
        WHERE b.id = ?
      `, [id]);

      if (!bug) {
        req.flash('error', 'Bug tidak ditemukan.');
        return res.redirect('/bugs');
      }

      const user = req.session.user;

      // Filter akses BA
      if (user.role === 'business_analyst' || user.role === 'ba') {
        const [[isAssigned]] = await db.query(
          'SELECT id FROM ba_assignments WHERE application_id = ? AND ba_id = ?',
          [bug.application_id, user.id]
        );
        if (!isAssigned) {
          req.flash('error', 'Anda tidak memiliki akses ke detail bug ini.');
          return res.redirect('/bugs');
        }
      }

      // Cek apakah tester ditugaskan ke aplikasi ini
      const [[isAssignedTester]] = await db.query(
        "SELECT id FROM testing_assignments WHERE application_id = ? AND tester_id = ?",
        [bug.application_id, user.id]
      );

      const [history] = await db.query(`
        SELECT bh.*, u.nama AS user_nama, u.role AS user_role FROM bug_history bh
        LEFT JOIN users u ON bh.user_id = u.id
        WHERE bh.bug_id = ? ORDER BY bh.created_at ASC
      `, [id]);

      // Ambil Kontributor
      const [contributors] = await db.query(`
        SELECT u.nama, u.role FROM bug_contributors bc
        JOIN users u ON bc.user_id = u.id
        WHERE bc.bug_id = ?
      `, [id]);

      res.render('bugs/detail', {
        title: bug.judul, bug, history,
        user, contributors,
        isAssignedTester: !!isAssignedTester
      });
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal memuat detail bug.');
      res.redirect('/bugs');
    }
  },

  // ─── Kerjakan Bug (Programmer/DSI klik "Kerjakan") ────────────────────
  // Mengubah status dari 'open' ke 'in_progress' dan assign ke dirinya sendiri
  kerjakan: async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.session.user;

      const [[bug]] = await db.query('SELECT * FROM bugs WHERE id = ?', [id]);
      if (!bug) {
        req.flash('error', 'Bug tidak ditemukan.');
        return res.redirect('/bugs');
      }

      // Cek testing belum selesai
      const [[app]] = await db.query('SELECT testing_finished FROM applications WHERE id = ?', [bug.application_id]);
      if (app && app.testing_finished) {
        req.flash('error', 'Testing sudah selesai. Bug tidak dapat dikerjakan lagi.');
        return res.redirect(`/bugs/${id}`);
      }

      if (!['open', 'in_progress', 'rejected', 'fixed'].includes(bug.status)) {
        req.flash('error', 'Status bug tidak memungkinkan untuk dikerjakan lagi.');
        return res.redirect(`/bugs/${id}`);
      }

      const statusLama = bug.status;

      // Update status ke in_progress (tetap gunakan COALESCE agar penanggung jawab pertama tidak berubah)
      await db.query(
        'UPDATE bugs SET status = "in_progress", assigned_to = COALESCE(assigned_to, ?), assigned_role = COALESCE(assigned_role, ?) WHERE id = ?',
        [user.id, user.role, id]
      );

      // Tambah ke Tim Kontributor
      await db.query(
        'INSERT IGNORE INTO bug_contributors (bug_id, user_id) VALUES (?, ?)',
        [id, user.id]
      );

      await db.query(
        'INSERT INTO bug_history (bug_id, user_id, status_lama, status_baru, keterangan) VALUES (?,?,?,?,?)',
        [id, user.id, statusLama, 'in_progress', `Programmer ${user.nama} bergabung sebagai kontributor.`]
      );

      req.flash('success', 'Anda telah bergabung sebagai tim kontributor bug ini!');
      res.redirect(`/bugs/${id}`);
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal memproses bug.');
      res.redirect(`/bugs/${req.params.id}`);
    }
  },

  // ─── Update Status (Programmer/DSI) ─────────────────────────────────────────
  updateStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status, komentar_programmer } = req.body;
      const user = req.session.user;

      // Tambah ke Kontributor secara otomatis jika dia update status
      await db.query(
        'INSERT IGNORE INTO bug_contributors (bug_id, user_id) VALUES (?, ?)',
        [id, user.id]
      );

      // Pastikan ada penanggung jawab utama jika belum ada
      await db.query(
        'UPDATE bugs SET assigned_to = COALESCE(assigned_to, ?), assigned_role = COALESCE(assigned_role, ?) WHERE id = ?',
        [user.id, user.role, id]
      );

      const [[bugInfo]] = await db.query(`
        SELECT b.status, a.status AS app_status, a.testing_finished, b.application_id
        FROM bugs b
        JOIN applications a ON b.application_id = a.id
        WHERE b.id = ?
      `, [id]);

      if (!bugInfo) {
        req.flash('error', 'Bug tidak ditemukan.');
        return res.redirect('/bugs');
      }

      // Blok jika testing sudah selesai (testing_finished=1)
      if (bugInfo.testing_finished) {
        req.flash('error', 'Testing sudah dinyatakan selesai. Tidak dapat mengubah status bug lagi.');
        return res.redirect(`/bugs/${id}`);
      }

      // Diizinkan jika status open, in_progress, rejected, atau fixed
      if (!['open', 'in_progress', 'rejected', 'fixed'].includes(bugInfo.status)) {
        req.flash('error', 'Bug sudah divalidasi, tidak dapat diupdate lagi.');
        return res.redirect(`/bugs/${id}`);
      }

      const statusLama = bugInfo.status;
      const updateData = { status, komentar_programmer };
      if (status === 'fixed') updateData.tanggal_fixed = new Date();

      if (['programmer', 'dsi'].includes(user.role)) {
        updateData.assigned_to = user.id;
        updateData.assigned_role = user.role;
      }

      await db.query('UPDATE bugs SET ? WHERE id = ?', [updateData, id]);
      await db.query(
        'INSERT INTO bug_history (bug_id, user_id, status_lama, status_baru, keterangan) VALUES (?,?,?,?,?)',
        [id, user.id, statusLama, status, komentar_programmer]
      );

      // Notifikasi ke Tester jika fixed
      if (status === 'fixed') {
        const [[bug]] = await db.query("SELECT tester_id, judul FROM bugs WHERE id = ?", [id]);
        await notifHelper.send(
          bug.tester_id,
          `Bug: ${bug.judul} telah diperbaiki oleh Programmer. Silakan diverifikasi.`,
          `/bugs/${id}`
        );
      }

      req.flash('success', status === 'fixed'
        ? 'Bug ditandai Fixed! Tester akan mendapat notifikasi untuk review.'
        : 'Status bug berhasil diupdate!');
      res.redirect('/bugs/' + id);
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal mengupdate status.');
      res.redirect('/bugs');
    }
  },

  // ─── Get Use Cases (AJAX) ───────────────────────────────────────────────────
  getUseCases: async (req, res) => {
    try {
      const [useCases] = await db.query(
        'SELECT id, judul FROM use_cases WHERE application_id = ? ORDER BY id ASC',
        [req.params.appId]
      );
      res.json(useCases);
    } catch (err) {
      res.json([]);
    }
  },

  // ─── Verifikasi Bug (Tester / Ketua Tester) ─────────────────────────────────
  closeBug: async (req, res) => {
    try {
      const { id } = req.params;
      const { action, catatan } = req.body;

      const [[bugRow]] = await db.query('SELECT status FROM bugs WHERE id=?', [id]);
      const statusLama = bugRow?.status;

      let statusBaru = 'verified';
      if (action === 'rejected' || action === 'rejected_with_notes') {
        statusBaru = 'rejected';
      }

      await db.query('UPDATE bugs SET status=? WHERE id=?', [statusBaru, id]);

      const keterangan = action === 'rejected'
        ? `DITOLAK: ${catatan}`
        : action === 'rejected_with_notes'
          ? `BERHASIL DENGAN CATATAN: ${catatan}`
          : `DIVERIFIKASI: ${catatan}`;

      await db.query(
        'INSERT INTO bug_history (bug_id, user_id, status_lama, status_baru, keterangan) VALUES (?,?,?,?,?)',
        [id, req.session.user.id, statusLama, statusBaru, catatan || keterangan]
      );

      const msgMap = {
        verified: 'Bug berhasil diverifikasi! Hasil: Berhasil.',
        rejected: action === 'rejected_with_notes'
          ? 'Bug ditutup dengan catatan! Hasil: Berhasil Dengan Catatan.'
          : 'Bug ditolak, dikembalikan ke programmer. Hasil: Gagal.'
      };

      // Kirim Notifikasi ke Programmer jika rejected / rejected_with_notes
      if (statusBaru === 'rejected') {
        const [contributors] = await db.query('SELECT user_id FROM bug_contributors WHERE bug_id = ?', [id]);
        const [[bugData]] = await db.query('SELECT judul FROM bugs WHERE id = ?', [id]);

        const notifMsg = action === 'rejected_with_notes'
          ? `Bug berhasil dengan catatan: ${bugData.judul}. Silakan dicek kembali.`
          : `Bug ditolak: ${bugData.judul}. Silakan diperbaiki kembali.`;

        for (const c of contributors) {
          await notifHelper.send(c.user_id, notifMsg, `/bugs/${id}`);
        }
        // Jika belum ada kontributor, kirim ke penanggung jawab utama
        if (contributors.length === 0) {
          const [[assigned]] = await db.query('SELECT assigned_to FROM bugs WHERE id = ?', [id]);
          if (assigned && assigned.assigned_to) {
            await notifHelper.send(assigned.assigned_to, notifMsg, `/bugs/${id}`);
          }
        }
      }

      req.flash('success', msgMap[action === 'rejected_with_notes' ? 'rejected' : statusBaru] || 'Status bug diupdate.');
      res.redirect(`/bugs/${id}`);
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal update bug.');
      res.redirect('/bugs');
    }
  },

  // ─── Selesai Testing (Tester / Ketua Tester) ────────────────────────────────
  selesaiTesting: async (req, res) => {
    try {
      const { id } = req.params; // bug id
      const user = req.session.user;

      const [[bug]] = await db.query('SELECT application_id FROM bugs WHERE id = ?', [id]);
      if (!bug) {
        req.flash('error', 'Bug tidak ditemukan.');
        return res.redirect('/bugs');
      }

      // Set testing_finished = 1
      await db.query(
        "UPDATE applications SET testing_finished = 1, status = 'selesai' WHERE id = ?",
        [bug.application_id]
      );
      await db.query(
        "UPDATE testing_assignments SET status = 'done' WHERE application_id = ?",
        [bug.application_id]
      );

      req.flash('success', 'Testing selesai! Semua proses fixing ditutup. Programmer/DSI tidak dapat mengerjakan lagi.');
      res.redirect(`/applications/${bug.application_id}`);
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal menyelesaikan testing.');
      res.redirect('/bugs');
    }
  },

  // ─── Riwayat Bug ────────────────────────────────────────────────────────────
  history: async (req, res) => {
    try {
      const user = req.session.user;
      let query = `
        SELECT bh.*, b.judul AS bug_judul, u.nama AS user_nama,
               a.nama_aplikasi, uc.judul AS use_case_judul,
               b.status AS bug_status, b.severity AS bug_kategori
        FROM bug_history bh
        JOIN bugs b ON bh.bug_id = b.id
        JOIN applications a ON b.application_id = a.id
        LEFT JOIN users u ON bh.user_id = u.id
        LEFT JOIN use_cases uc ON b.use_case_id = uc.id
      `;
      let params = [];

      if (user.role === 'business_analyst' || user.role === 'ba') {
        query += ' WHERE b.application_id IN (SELECT application_id FROM ba_assignments WHERE ba_id = ?)';
        params.push(user.id);
      } else if (user.role === 'tester') {
        query += ' WHERE b.tester_id = ?';
        params.push(user.id);
      } else if (user.role === 'tim_leader') {
        query += ' WHERE a.tim_leader_id = ?';
        params.push(user.id);
      } else if (user.role === 'programmer' || user.role === 'dsi') {
        query += ' WHERE b.application_id IN (SELECT application_id FROM developer_assignments WHERE user_id = ?)';
        params.push(user.id);
      }

      query += ' ORDER BY bh.created_at DESC LIMIT 100';
      const [history] = await db.query(query, params);
      res.render('bugs/history', { title: 'Riwayat Perubahan Status', history, user });
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal memuat riwayat.');
      res.redirect('/dashboard');
    }
  },

  // ─── Hapus Bug ───────────────────────────────────────────────────────────────
  destroy: async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.session.user;

      // Hanya Ketua Tester, Tester pemilik bug, atau Admin
      const [[bug]] = await db.query('SELECT tester_id, application_id FROM bugs WHERE id = ?', [id]);
      if (!bug) {
        req.flash('error', 'Bug tidak ditemukan.');
        return res.redirect('/bugs');
      }

      if (user.role === 'tester' && bug.tester_id !== user.id) {
        req.flash('error', 'Anda hanya bisa menghapus bug yang Anda laporkan.');
        return res.redirect(`/bugs/${id}`);
      }

      const appId = bug.application_id;
      await db.query("DELETE FROM bug_history WHERE bug_id = ?", [id]);
      await db.query("DELETE FROM bugs WHERE id = ?", [id]);

      req.flash('success', 'Bug berhasil dihapus.');
      res.redirect(`/applications/${appId}`);
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal menghapus bug.');
      res.redirect('/bugs');
    }
  }
};

module.exports = bugController;
