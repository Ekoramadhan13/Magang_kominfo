const db = require('../src/config/database');

async function run() {
    try {
        console.log('Memulai update kategori bug...');

        // 1. Ubah enum severity di tabel bugs
        // Kita gunakan VARCHAR agar lebih fleksibel atau update ENUM
        await db.query("ALTER TABLE bugs MODIFY COLUMN severity VARCHAR(100) DEFAULT 'gagal'");
        console.log('- Kolom severity diubah menjadi VARCHAR');

        // 2. Jika ada data lama, kita bisa biarkan atau update, tapi ini project baru biasanya kosong atau bisa direset
        
        console.log('Update selesai!');
    } catch (err) {
        console.error('Update gagal:', err);
    } finally {
        process.exit(0);
    }
}

run();
