require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./src/config/database');

async function checkAndFix() {
    try {
        const [users] = await db.query('SELECT id, nama, email, role, is_active FROM users');
        console.log('=== SEMUA USER ===');
        users.forEach(u => console.log(`  [${u.role}] ${u.email} (id:${u.id}, active:${u.is_active})`));

        const [apps] = await db.query('SELECT id, nama_aplikasi, status, tim_leader_id FROM applications');
        console.log('\n=== APPLICATIONS ===');
        apps.forEach(a => console.log(`  [id:${a.id}] ${a.nama_aplikasi} - status:${a.status}`));

        const [ta] = await db.query('SELECT * FROM testing_assignments');
        console.log('\n=== TESTING_ASSIGNMENTS ===');
        console.log(ta.length === 0 ? '  (kosong)' : JSON.stringify(ta, null, 2));

        const hashed = await bcrypt.hash('password', 10);
        await db.query('UPDATE users SET password = ?', [hashed]);
        console.log('\n✅ Semua password direset ke "password"');

        if (apps.length > 0) {
            const testers = users.filter(u => u.role === 'tester');
            const ketuaTesters = users.filter(u => u.role === 'ketua_tester');
            const leaders = users.filter(u => u.role === 'tim_leader');

            console.log(`\nTim Leader ditemukan: ${leaders.length}`);
            console.log(`Ketua Tester ditemukan: ${ketuaTesters.length}`);
            console.log(`Tester ditemukan: ${testers.length}`);

            if (testers.length > 0 && apps.length > 0 && ketuaTesters.length > 0) {
                
                for (const app of apps) {
                    await db.query(
                        "UPDATE applications SET ketua_tester_id=?, status='testing' WHERE id=?",
                        [ketuaTesters[0].id, app.id]
                    );
                    console.log(`\n✅ Set ketua_tester untuk aplikasi: ${app.nama_aplikasi}`);

                    
                    for (const tester of testers) {
                        await db.query(
                            "INSERT INTO testing_assignments (application_id, tester_id, assigned_by, status) VALUES (?,?,?,'on_going') ON DUPLICATE KEY UPDATE status='on_going'",
                            [app.id, tester.id, ketuaTesters[0].id]
                        );
                        console.log(`  ✅ Assign tester ${tester.email} ke aplikasi ${app.nama_aplikasi}`);
                    }
                }
            } else {
                console.log('\n⚠️  Tidak ada tester/ketua_tester/aplikasi yang cukup untuk assign otomatis.');
                console.log('Assign manual diperlukan melalui UI setelah login sebagai ketua_tester.');
            }
        }


        const [taFinal] = await db.query('SELECT ta.*, u.email AS tester_email, a.nama_aplikasi FROM testing_assignments ta JOIN users u ON ta.tester_id=u.id JOIN applications a ON ta.application_id=a.id');
        console.log('\n=== FINAL testing_assignments ===');
        taFinal.forEach(t => console.log(`  ${t.tester_email} → ${t.nama_aplikasi} [${t.status}]`));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
checkAndFix();
