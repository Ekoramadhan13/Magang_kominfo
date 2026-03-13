const db = require('./src/config/database');

async function syncApplicationStatus() {
    try {
        console.log('Starting application status synchronization...');
        const [apps] = await db.query("SELECT id, nama_aplikasi, status FROM applications WHERE status != 'selesai'");

        for (const app of apps) {
            const [[stats]] = await db.query(`
        SELECT COUNT(*) as total, 
               SUM(CASE WHEN status IN ('verified', 'closed') THEN 1 ELSE 0 END) as completed
        FROM bugs WHERE application_id = ?
      `, [app.id]);

            const total = Number(stats.total);
            const completed = Number(stats.completed);

            if (total > 0 && total === completed) {
                console.log(`Updating ${app.nama_aplikasi} (ID: ${app.id}) status to 'selesai'...`);
                await db.query("UPDATE applications SET status = 'selesai' WHERE id = ?", [app.id]);
            }
        }
        console.log('Synchronization complete!');
        process.exit(0);
    } catch (err) {
        console.error('Error during synchronization:', err);
        process.exit(1);
    }
}

syncApplicationStatus();
