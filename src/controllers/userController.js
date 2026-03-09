const db = require('../config/database');
const bcrypt = require('bcryptjs');

const userController = {
  index: async (req, res) => {
    try {
      const [users] = await db.query('SELECT id, nama, email, role, is_active, created_at FROM users ORDER BY created_at DESC');
      res.render('users/index', { title: 'Manajemen User', users });
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal memuat data user.');
      res.redirect('/dashboard');
    }
  },

  create: (req, res) => {
    res.render('users/create', { title: 'Tambah User' });
  },

  store: async (req, res) => {
    try {
      const { nama, email, password, role } = req.body;
      if (!nama || !email || !password || !role) {
        req.flash('error', 'Semua field wajib diisi.');
        return res.redirect('/users/create');
      }
      const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
      if (existing.length > 0) {
        req.flash('error', 'Email sudah terdaftar.');
        return res.redirect('/users/create');
      }
      const hashed = await bcrypt.hash(password, 10);
      await db.query('INSERT INTO users (nama, email, password, role) VALUES (?,?,?,?)', [nama, email, hashed, role]);
      req.flash('success', `User ${nama} berhasil ditambahkan!`);
      res.redirect('/users');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal menyimpan user.');
      res.redirect('/users/create');
    }
  },

  edit: async (req, res) => {
    try {
      const [[user]] = await db.query('SELECT id, nama, email, role, is_active FROM users WHERE id = ?', [req.params.id]);
      if (!user) { req.flash('error', 'User tidak ditemukan.'); return res.redirect('/users'); }
      res.render('users/edit', { title: 'Edit User', editUser: user });
    } catch (err) {
      req.flash('error', 'Gagal memuat form edit.'); res.redirect('/users');
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { nama, email, role, is_active, password } = req.body;
      if (password && password.trim() !== '') {
        const hashed = await bcrypt.hash(password, 10);
        await db.query('UPDATE users SET nama=?, email=?, role=?, is_active=?, password=? WHERE id=?', [nama, email, role, is_active, hashed, id]);
      } else {
        await db.query('UPDATE users SET nama=?, email=?, role=?, is_active=? WHERE id=?', [nama, email, role, is_active, id]);
      }
      req.flash('success', 'User berhasil diupdate!');
      res.redirect('/users');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal mengupdate user.');
      res.redirect('/users/' + req.params.id + '/edit');
    }
  },

  destroy: async (req, res) => {
    try {
      if (parseInt(req.params.id) === req.session.user.id) {
        req.flash('error', 'Tidak bisa menghapus akun sendiri.');
        return res.redirect('/users');
      }
      await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
      req.flash('success', 'User berhasil dihapus.');
      res.redirect('/users');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal menghapus user.');
      res.redirect('/users');
    }
  },

  showChangePassword: (req, res) => {
    res.render('users/change-password', { title: 'Ganti Password' });
  },

  changePassword: async (req, res) => {
    try {
      const { password_lama, password_baru, konfirmasi_password } = req.body;
      if (password_baru !== konfirmasi_password) {
        req.flash('error', 'Password baru dan konfirmasi tidak cocok.');
        return res.redirect('/users/change-password');
      }
      const [[user]] = await db.query('SELECT password FROM users WHERE id = ?', [req.session.user.id]);
      const match = await bcrypt.compare(password_lama, user.password);
      if (!match) {
        req.flash('error', 'Password lama salah.');
        return res.redirect('/users/change-password');
      }
      const hashed = await bcrypt.hash(password_baru, 10);
      await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.session.user.id]);
      req.flash('success', 'Password berhasil diubah!');
      res.redirect('/dashboard');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal mengganti password.');
      res.redirect('/users/change-password');
    }
  }
};

module.exports = userController;