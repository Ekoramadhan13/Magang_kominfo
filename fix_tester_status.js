const db = require('./src/config/database');
async function run() {
    try {
        // Update all testers as 'done' for applications that are already 'selesai'
        await db.query(`
            UPDATE testing_assignments ta
            JOIN applications a ON ta.application_id = a.id
            SET ta.status = 'done'
            WHERE a.status = 'selesai'
        `);
        console.log('SUCCESS: All tester statuses updated for finished applications');
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
run();
