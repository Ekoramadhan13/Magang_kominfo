const db = require('../config/database');

const Bug = {
  findAll: async (filter = {}) => {
    let query = `
      SELECT b.*, a.nama_aplikasi, u.nama AS tester_nama,
             uc.judul AS use_case_judul, p.nama AS programmer_nama
      FROM bugs b
      LEFT JOIN applications a ON b.application_id = a.id
      LEFT JOIN users u ON b.tester_id = u.id
      LEFT JOIN use_cases uc ON b.use_case_id = uc.id
      LEFT JOIN users p ON b.assigned_to = p.id
      WHERE 1=1
    `;
    const params = [];
    if (filter.tester_id)      { query += ' AND b.tester_id = ?';      params.push(filter.tester_id); }
    if (filter.assigned_to)    { query += ' AND b.assigned_to = ?';    params.push(filter.assigned_to); }
    if (filter.application_id) { query += ' AND b.application_id = ?'; params.push(filter.application_id); }
    if (filter.status)         { query += ' AND b.status = ?';         params.push(filter.status); }
    query += ' ORDER BY b.created_at DESC';
    const [rows] = await db.query(query, params);
    return rows;
  },
  findById: async (id) => {
    const [[row]] = await db.query(`
      SELECT b.*, a.nama_aplikasi, u.nama AS tester_nama,
             uc.judul AS use_case_judul, p.nama AS programmer_nama
      FROM bugs b
      LEFT JOIN applications a ON b.application_id = a.id
      LEFT JOIN users u ON b.tester_id = u.id
      LEFT JOIN use_cases uc ON b.use_case_id = uc.id
      LEFT JOIN users p ON b.assigned_to = p.id
      WHERE b.id = ?
    `, [id]);
    return row;
  },
  create: async (data) => {
    const [result] = await db.query('INSERT INTO bugs SET ?', [data]);
    return result.insertId;
  },
  update: async (id, data) => {
    const [result] = await db.query('UPDATE bugs SET ? WHERE id = ?', [data, id]);
    return result.affectedRows;
  },
  getHistory: async (bugId) => {
    const [rows] = await db.query(`
      SELECT bh.*, u.nama AS user_nama FROM bug_history bh
      LEFT JOIN users u ON bh.user_id = u.id
      WHERE bh.bug_id = ? ORDER BY bh.created_at ASC
    `, [bugId]);
    return rows;
  },
  getStats: async () => {
    const [[stats]] = await db.query(`
      SELECT COUNT(*) AS total,
        SUM(status='open') AS open, SUM(status='in_progress') AS in_progress,
        SUM(status='fixed') AS fixed, SUM(status='verified') AS verified,
        SUM(status='closed') AS closed,
        SUM(severity='critical') AS critical, SUM(severity='major') AS major
      FROM bugs
    `);
    return stats;
  }
};

module.exports = Bug;