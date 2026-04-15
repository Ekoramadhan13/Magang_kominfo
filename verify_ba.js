const db = require('./src/config/database');
async function run() {
    try {
        const [users] = await db.query("SELECT id, nama, role FROM users");
        users.forEach(u => {
            if (u.role === 'business_analyst' || u.role === 'ba') {
                console.log('FOUND BA:', JSON.stringify(u));
            }
        });

        const [tables] = await db.query('SHOW TABLES');
        const tableList = tables.map(r => Object.values(r)[0]);
        console.log('TABLES:', tableList.join(', '));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
run();
