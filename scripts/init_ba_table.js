const db = require('./src/config/database');

async function createTable() {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS ba_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        application_id INT NOT NULL,
        ba_id INT NOT NULL,
        assigned_by INT NOT NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_assignment (application_id, ba_id),
        FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
        FOREIGN KEY (ba_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.query(query);
    console.log('Table ba_assignments created or already exists.');
    process.exit(0);
  } catch (err) {
    console.error('Error creating table:', err);
    process.exit(1);
  }
}

createTable();
