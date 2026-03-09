const db = require('../config/database');
const bcrypt = require('bcryptjs');

const User = {
  findAll: async () => {
    const [rows] = await db.query('SELECT id, nama, email, role, is_active, created_at FROM users ORDER BY nama ASC');
    return rows;
  },
  findById: async (id) => {
    const [[row]] = await db.query('SELECT id, nama, email, role, is_active FROM users WHERE id = ?', [id]);
    return row;
  },
  findByEmail: async (email) => {
    const [[row]] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    return row;
  },
  findByRole: async (role) => {
    const [rows] = await db.query('SELECT id, nama, email FROM users WHERE role = ? AND is_active = 1', [role]);
    return rows;
  },
  create: async (data) => {
    data.password = await bcrypt.hash(data.password, 10);
    const [result] = await db.query('INSERT INTO users SET ?', [data]);
    return result.insertId;
  },
  update: async (id, data) => {
    if (data.password && data.password.trim() !== '') {
      data.password = await bcrypt.hash(data.password, 10);
    } else {
      delete data.password;
    }
    const [result] = await db.query('UPDATE users SET ? WHERE id = ?', [data, id]);
    return result.affectedRows;
  },
  delete: async (id) => {
    const [result] = await db.query('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows;
  },
  verifyPassword: async (plain, hashed) => {
    return bcrypt.compare(plain, hashed);
  }
};

module.exports = User;