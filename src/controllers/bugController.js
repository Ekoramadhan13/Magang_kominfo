const db = require('../config/database');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const bugController = {
  index: async (req, res) => {
    try {
      const user = req.session.user;
      let query = `SELECT b.*, a.nama_aplikasi, u.nama as tester_nama,
                   uc.judul as use_case_judul
                   FROM bugs b
                   LEFT JOIN applications a ON b.application_id = a.id
                   LEFT JOIN users u ON b.tester_id = u.id
                   LEFT JOIN use_cases uc ON b.use_case_id = uc.id`;
      let params = [];
      if (user.role === 'tester') {
        query += ' WHERE b.tester_id = ?';
        params.push(user.id);
      }

      else if (user.role === 'ketua_tester') {
        query += ' WHERE a.ketua_tester_id = ?';
        params.push(user.id);
      }
      else if (user.role === 'programmer' || user.role === 'dsi') {
        query += ' WHERE b.assigned_to = ?';
        params.push(user.id);
      }
      query += ' ORDER BY b.created_at DESC';
      const [bugs] = await db.query(query, params);
      res.render('bugs/index', { title: 'Daftar Bugs', bugs, user });
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal memuat data bugs.');
      res.redirect('/dashboard');
    }
  },

  create: async (req, res) => {
    try {
      let query = '';
      let params = [req.session.user.id];

      if (req.session.user.role === 'ketua_tester') {
        query = `SELECT * FROM applications WHERE ketua_tester_id = ?`;
      } else {
        query = `SELECT a.* FROM applications a
                 JOIN testing_assignments ta ON a.id = ta.application_id
                 WHERE ta.tester_id = ? AND ta.status = 'on_going'`;
      }

      const [apps] = await db.query(query, params);
      res.render('bugs/create', { title: 'Laporkan Bug', apps });
    } catch (err) {
      req.flash('error', 'Gagal memuat form.');
      res.redirect('/bugs');
    }
  },

  store: [upload.single('screenshot'), async (req, res) => {
    try {
      let {
        application_id, use_case_id, judul, deskripsi,
        langkah_reproduksi, expected_result, actual_result,
        severity, priority
      } = req.body;

      const screenshot = req.file ? req.file.filename : null;
      use_case_id = (use_case_id === '') ? null : use_case_id;

      await db.query(
        `INSERT INTO bugs (application_id, use_case_id, tester_id,
          judul, deskripsi, langkah_reproduksi, expected_result,
          actual_result, severity, priority, screenshot)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [application_id, use_case_id, req.session.user.id,
          judul, deskripsi, langkah_reproduksi, expected_result,
          actual_result, severity, priority, screenshot]
      );
      req.flash('success', 'Bug berhasil dilaporkan!');
      res.redirect('/bugs');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal menyimpan bug.');
      res.redirect('/bugs/create');
    }
  }],

  updateStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status, komentar_programmer } = req.body;

      const [oldBug] = await db.query('SELECT status FROM bugs WHERE id=?', [id]);
      const statusLama = oldBug[0]?.status;

      const updateData = { status, komentar_programmer };
      if (status === 'fixed') updateData.tanggal_fixed = new Date();
      await db.query('UPDATE bugs SET ? WHERE id = ?', [updateData, id]);

      await db.query(
        'INSERT INTO bug_history (bug_id, user_id, status_lama, status_baru, keterangan) VALUES (?,?,?,?,?)',
        [id, req.session.user.id, statusLama, status, komentar_programmer]
      );
      req.flash('success', 'Status bug berhasil diupdate!');
      res.redirect('/bugs');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal mengupdate status.');
      res.redirect('/bugs');
    }
  },

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

  show: async (req, res) => {
    try {
      const { id } = req.params;
      const [[bug]] = await db.query(`
        SELECT b.*, a.nama_aplikasi, u.nama AS tester_nama,
               uc.judul AS use_case_judul, p.nama AS programmer_nama
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
      const [history] = await db.query(`
        SELECT bh.*, u.nama AS user_nama FROM bug_history bh
        LEFT JOIN users u ON bh.user_id = u.id
        WHERE bh.bug_id = ? ORDER BY bh.created_at ASC
      `, [id]);
      const [programmers] = await db.query(
        "SELECT id, nama, role FROM users WHERE role IN ('programmer','dsi') AND is_active = 1"
      );
      res.render('bugs/detail', { title: bug.judul, bug, history, programmers });
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal memuat detail bug.');
      res.redirect('/bugs');
    }
  },

  closeBug: async (req, res) => {
    try {
      const { id } = req.params;
      const { action, catatan } = req.body;


      const [oldBug] = await db.query('SELECT status FROM bugs WHERE id=?', [id]);
      const statusLama = oldBug[0]?.status;

      const statusBaru = action === 'rejected' ? 'in_progress' : 'verified';

      await db.query('UPDATE bugs SET status=? WHERE id=?', [statusBaru, id]);

      const keterangan = action === 'rejected' ? `DITOLAK: ${catatan}` : `DIVERIFIKASI: ${catatan}`;
      await db.query(
        'INSERT INTO bug_history (bug_id, user_id, status_lama, status_baru, keterangan) VALUES (?,?,?,?,?)',
        [id, req.session.user.id, statusLama, statusBaru, catatan || keterangan]
      );

      req.flash('success', action === 'verified' ? 'Bug sudah diverifikasi!' : 'Bug ditolak, status kembali menjadi In Progress.');


      if (action === 'verified') {
        const [bugsForApp] = await db.query('SELECT application_id FROM bugs WHERE id = ?', [id]);
        const appId = bugsForApp[0]?.application_id;

        if (appId) {
          const [[stats]] = await db.query(`
            SELECT COUNT(*) as total, 
                   SUM(CASE WHEN status IN ('verified', 'closed') THEN 1 ELSE 0 END) as completed
            FROM bugs WHERE application_id = ?
          `, [appId]);

          const total = Number(stats.total);
          const completed = Number(stats.completed);

          if (total > 0 && total === completed) {
            await db.query("UPDATE applications SET status = 'selesai' WHERE id = ?", [appId]);
          }
        }
      }

      res.redirect(`/bugs/${id}`);
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal update bug.');
      res.redirect('/bugs');
    }
  },

  assignBug: async (req, res) => {
    try {
      const { id } = req.params;
      const { assigned_to, assigned_role } = req.body;

      const [oldBug] = await db.query('SELECT status FROM bugs WHERE id=?', [id]);
      const statusLama = oldBug[0]?.status;
      const statusBaru = 'in_progress';

      await db.query(
        'UPDATE bugs SET assigned_to = ?, assigned_role = ?, status = ? WHERE id = ?',
        [assigned_to, assigned_role, statusBaru, id]
      );

      const [programmer] = await db.query('SELECT nama FROM users WHERE id=?', [assigned_to]);
      const namaProgrammer = programmer[0]?.nama || 'Unknown';

      const keterangan = `Bug ditugaskan kepada ${namaProgrammer} (${assigned_role})`;

      await db.query(
        'INSERT INTO bug_history (bug_id, user_id, status_lama, status_baru, keterangan) VALUES (?,?,?,?,?)',
        [id, req.session.user.id, statusLama, statusBaru, keterangan]
      );

      req.flash('success', 'Berhasil menugaskan bug, status berubah menjadi In Progress.');
      res.redirect(`/bugs/${id}`);
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal menugaskan bug.');
      res.redirect(`/bugs/${req.params.id}`);
    }
  },

  history: async (req, res) => {
    try {
      const [history] = await db.query(`
        SELECT bh.*, b.judul AS bug_judul, u.nama AS user_nama, a.nama_aplikasi
        FROM bug_history bh
        JOIN bugs b ON bh.bug_id = b.id
        JOIN applications a ON b.application_id = a.id
        LEFT JOIN users u ON bh.user_id = u.id
        ORDER BY bh.created_at DESC LIMIT 100
      `);
      res.render('bugs/history', { title: 'Riwayat Perubahan Status', history });
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal memuat riwayat.');
      res.redirect('/dashboard');
    }
  }
};

module.exports = bugController;
