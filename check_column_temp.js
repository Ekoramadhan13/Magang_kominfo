const db = require('./src/config/database');

async function checkColumn() {
    try {
        const [rows] = await db.query('DESCRIBE bugs assigned_role');
        console.log('Column Info:', rows[0]);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkColumn();
