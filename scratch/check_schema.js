const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkSchema() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3309,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bugs_handling'
  });

  try {
    const [rows] = await db.query('DESCRIBE notifications');
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await db.end();
  }
}

checkSchema();
