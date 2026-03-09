require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./src/config/database');

async function deepDiagnose() {
    try {
        console.log('=== DIAGNOSA MENDALAM ===\n');

        
        const [users] = await db.query('SELECT id, nama, email, password, is_active FROM users');
        console.log(`Total user: ${users.length}`);

        for (const user of users) {
            console.log(`\n--- User: ${user.email} ---`);
            console.log(`  is_active: ${user.is_active}`);
            console.log(`  Password hash: ${user.password}`);

        
            const testPasswords = ['password', 'Password', 'password123', 'admin', 'admin123', '123456'];
            for (const testPwd of testPasswords) {
                try {
                    const match = await bcrypt.compare(testPwd, user.password);
                    if (match) {
                        console.log(`  ✅ COCOK dengan password: "${testPwd}"`);
                    }
                } catch (e) {
                    console.log(`  ❌ Error saat compare dengan "${testPwd}": ${e.message}`);
                }
            }
        }

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

deepDiagnose();
