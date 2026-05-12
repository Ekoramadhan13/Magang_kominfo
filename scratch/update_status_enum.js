const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateStatus() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3309,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bugs_handling'
  });

  try {
    console.log('Updating testing_assignments.status ENUM...');
    
    // 1. Update existing 'open' to 'pending' (temporarily allow both or change type to string)
    await db.query("ALTER TABLE testing_assignments MODIFY COLUMN status VARCHAR(20)");
    await db.query("UPDATE testing_assignments SET status = 'pending' WHERE status = 'open'");
    
    // 2. Set new ENUM
    await db.query("ALTER TABLE testing_assignments MODIFY COLUMN status ENUM('pending', 'on_going', 'done') DEFAULT 'pending'");
    
    console.log('Migration successful!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await db.end();
  }
}

migrateStatus();
