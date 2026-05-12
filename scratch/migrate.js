const db = require('../src/config/database');

async function run() {
    try {
        console.log('Memulai migrasi database...');

        // 1. Tambah kolom role di use_cases
        const [columns] = await db.query("SHOW COLUMNS FROM use_cases LIKE 'role'");
        if (columns.length === 0) {
            await db.query("ALTER TABLE use_cases ADD COLUMN role VARCHAR(100) AFTER expected_result");
            console.log('- Kolom role berhasil ditambahkan ke tabel use_cases');
        }

        // 2. Buat tabel developer_assignments
        await db.query(`
            CREATE TABLE IF NOT EXISTS developer_assignments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                application_id INT NOT NULL,
                user_id INT NOT NULL,
                assigned_by INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('- Tabel developer_assignments siap');

        // 3. Buat tabel ketua_tester_assignments
        await db.query(`
            CREATE TABLE IF NOT EXISTS ketua_tester_assignments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                application_id INT NOT NULL,
                ketua_tester_id INT NOT NULL,
                assigned_by INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
                FOREIGN KEY (ketua_tester_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('- Tabel ketua_tester_assignments siap');

        console.log('Migrasi selesai!');
    } catch (err) {
        console.error('Migrasi gagal:', err);
    } finally {
        process.exit(0);
    }
}

run();
