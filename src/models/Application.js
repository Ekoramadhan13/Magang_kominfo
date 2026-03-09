const db = require('../config/database');

const Application = {
  findAll: async () => {
    const [rows] = await db.query(`
      SELECT a.*, u.nama AS leader_nama, kt.nama AS ketua_tester_nama,
             COUNT(DISTINCT b.id) AS total_bugs,
             SUM(b.status = 'open') AS bugs_open,
             SUM(b.status = 'fixed') AS bugs_fixed
      FROM applications a
      LEFT JOIN users u ON a.tim_leader_id = u.id
      LEFT JOIN users kt ON a.ketua_tester_id = kt.id
      LEFT JOIN bugs b ON a.id = b.application_id
      GROUP BY a.id ORDER BY a.created_at DESC
    `);
    return rows;
  },
  findById: async (id) => {
    const [[row]] = await db.query(`
      SELECT a.*, u.nama AS leader_nama, kt.nama AS ketua_tester_nama
      FROM applications a
      LEFT JOIN users u ON a.tim_leader_id = u.id
      LEFT JOIN users kt ON a.ketua_tester_id = kt.id
      WHERE a.id = ?
    `, [id]);
    return row;
  },
  create: async (data) => {
    const [result] = await db.query('INSERT INTO applications SET ?', [data]);
    return result.insertId;
  },
  update: async (id, data) => {
    const [result] = await db.query('UPDATE applications SET ? WHERE id = ?', [data, id]);
    return result.affectedRows;
  },
  delete: async (id) => {
    const [result] = await db.query('DELETE FROM applications WHERE id = ?', [id]);
    return result.affectedRows;
  },
  getBugStats: async (id) => {
    const [[stats]] = await db.query(`
      SELECT COUNT(*) AS total,
        SUM(status='open') AS open, SUM(status='in_progress') AS in_progress,
        SUM(status='fixed') AS fixed, SUM(status='verified') AS verified,
        SUM(status='closed') AS closed, SUM(status='rejected') AS rejected
      FROM bugs WHERE application_id = ?
    `, [id]);
    return stats;
  }
};

module.exports = Application;