require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./src/config/database');

async function resetPasswords() {
    try {
        console.log('=== RESET SEMUA PASSWORD KE "password" ===\n');

        const [users] = await db.query('SELECT id, nama, email FROM users');
        const hashed = await bcrypt.hash('password', 10);

        for (const user of users) {
            await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, user.id]);
            console.log(`✅ Reset password untuk: ${user.email}`);
        }

        console.log('\n✅ Semua password berhasil direset ke "password"!');
        console.log('Silakan login dengan email Anda dan password: password');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

resetPasswords();
