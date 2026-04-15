const db = require('./src/config/database');
async function run() {
    try {
        await db.query("ALTER TABLE bugs MODIFY COLUMN status VARCHAR(50)");
        console.log('SUCCESS: Column changed to VARCHAR');
    } catch (err) {
        console.error('ERROR:', err);
    } finally {
        process.exit(0);
    }
}
run();
