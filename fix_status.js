const db = require('./src/config/database');
async function run() {
    try {
        await db.query("ALTER TABLE bugs MODIFY COLUMN status VARCHAR(50) DEFAULT 'open'");
        await db.query("UPDATE bugs SET status = 'open' WHERE status IS NULL OR status = ''");
        console.log('SUCCESS: Database status fixed');
    } catch (err) {
        console.error('ERROR:', err);
    } finally {
        process.exit(0);
    }
}
run();
