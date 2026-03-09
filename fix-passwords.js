require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./src/config/database');

async function checkAndFixPasswords() {
  try {
    const [users] = await db.query('SELECT id, nama, email, password FROM users');

    console.log(`\n=== Ditemukan ${users.length} user ===\n`);

    for (const user of users) {
      const isHashed = user.password && user.password.startsWith('$2');
      console.log(`User: ${user.email}`);
      console.log(`  Password di DB: ${user.password}`);
      console.log(`  Sudah di-hash bcrypt: ${isHashed ? 'YA' : 'TIDAK (PLAIN TEXT!)'}`);
      console.log('');
    }

    
    const plainTextUsers = users.filter(u => !u.password || !u.password.startsWith('$2'));

    if (plainTextUsers.length > 0) {
      console.log(`\n⚠️  Ada ${plainTextUsers.length} user dengan password PLAIN TEXT!`);
      console.log('Memperbarui semua password dengan bcrypt hash dari kata sandi aslinya...\n');

      for (const user of plainTextUsers) {
        const originalPassword = user.password; 
        const hashed = await bcrypt.hash(originalPassword, 10);
        await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, user.id]);
        console.log(`✅ User ${user.email} - password "${originalPassword}" berhasil di-hash`);
      }

      console.log('\n✅ Semua password sudah diperbaiki!');
      console.log('Sekarang coba login kembali dengan password yang sama.');
    } else {
      console.log('\n✅ Semua password sudah dalam format bcrypt, tidak perlu diperbaiki.');
      console.log('\nKemungkinan masalah lain:');
      console.log('- Periksa kolom is_active (harus = 1)');

  
      const [activeCheck] = await db.query('SELECT id, email, is_active FROM users');
      for (const u of activeCheck) {
        console.log(`  ${u.email} - is_active: ${u.is_active}`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkAndFixPasswords();
