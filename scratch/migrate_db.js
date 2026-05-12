const db = require('../src/config/database');

async function run() {
  try {
    // Add url column if it doesn't exist (double check)
    try {
      await db.query("ALTER TABLE applications ADD COLUMN url VARCHAR(255) AFTER versi");
      console.log('Added url column to applications');
    } catch (e) {
      if (e.code === 'ER_DUP_COLUMN' || e.code === 'ER_DUP_FIELDNAME') console.log('url column already exists');
      else throw e;
    }

    // Update testing_assignments status
    await db.query("ALTER TABLE testing_assignments MODIFY COLUMN status ENUM('open', 'on_going', 'done') DEFAULT 'open'");
    console.log('Updated testing_assignments status enum');

    // Migrate old statuses
    await db.query("UPDATE testing_assignments SET status = 'open' WHERE status = 'assigned'");
    console.log('Migrated status assigned to open');

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
