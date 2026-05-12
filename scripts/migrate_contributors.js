const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateContributors() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3309,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bugs_handling'
  });

  try {
    console.log('Creating bug_contributors table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS bug_contributors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bug_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY (bug_id, user_id),
        FOREIGN KEY (bug_id) REFERENCES bugs(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);
    console.log('Migration successful!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await db.end();
  }
}

migrateContributors();
