const db = require('./src/config/database');
async function run() {
    try {
        const [baUsers] = await db.query("SELECT id, nama, role FROM users WHERE role IN ('business_analyst', 'ba')");
        console.log('BA Users:', JSON.stringify(baUsers));

        const [tables] = await db.query('SHOW TABLES');
        console.log('Tables:', JSON.stringify(tables.map(r => Object.values(r)[0])));

        // Check if there are any other assignment tables
        const assignmentTables = tables.filter(r => Object.values(r)[0].toLowerCase().includes('assignment'));
        console.log('Assignment Tables found:', JSON.stringify(assignmentTables.map(r => Object.values(r)[0])));

    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
run();
