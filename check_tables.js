const db = require('./src/config/database');
async function run() {
    try {
        const [rows] = await db.query('SHOW TABLES');
        console.log('Tables:', rows.map(r => Object.values(r)[0]));
        
        const [ba] = await db.query("SHOW TABLES LIKE 'ba_assignments'");
        console.log('ba_assignments exists:', ba.length > 0);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
run();
