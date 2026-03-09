const db = require('./src/config/database');

async function updateColumn() {
    try {
        console.log('Updating column assigned_role table bugs...');
        await db.query('ALTER TABLE bugs MODIFY assigned_role VARCHAR(50)');
        console.log('Column assigned_role successfully updated to VARCHAR(50)!');

    
        console.log('Checking bug_history column length...');
        await db.query('ALTER TABLE bug_history MODIFY keterangan TEXT');
        console.log('Column keterangan in bug_history successfully updated to TEXT!');

        process.exit(0);
    } catch (err) {
        console.error('Failed to update column:', err);
        process.exit(1);
    }
}

updateColumn();
