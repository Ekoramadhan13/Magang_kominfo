const bcrypt = require('bcryptjs');
const db = require('../config/database');

const authController = {
  showLogin: (req, res) => {
    res.render('auth/login', { title: 'Login - Bugs Handling' });
  },

  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        req.flash('error', 'Email dan password wajib diisi.');
        return res.redirect('/login');
      }
      const [users] = await db.query(
        'SELECT * FROM users WHERE email = ? AND is_active = 1', [email]
      );
      if (users.length === 0) {
        req.flash('error', 'Email atau password salah.');
        return res.redirect('/login');
      }
      const user = users[0];
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        req.flash('error', 'Email atau password salah.');
        return res.redirect('/login');
      }

      req.session.user = {
        id: user.id, nama: user.nama,
        email: user.email, role: user.role
      };
      req.flash('success', `Selamat datang, ${user.nama}!`);
      res.redirect('/dashboard');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Terjadi kesalahan server.');
      res.redirect('/login');
    }
  },

  logout: (req, res) => {
    req.session.destroy();
    res.redirect('/login');
  }
};

module.exports = authController;
