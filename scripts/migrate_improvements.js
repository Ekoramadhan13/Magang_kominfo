/**
 * Migration: Perbaikan Sistem Bugs-Handling
 * Menambahkan kolom testing_finished ke tabel applications
 * dan memastikan struktur tabel bugs sudah sesuai
 */

const db = require('../src/config/database');

async function migrate() {
  try {
    console.log('🚀 Menjalankan migration...');

    // 1. Tambah kolom testing_finished ke tabel applications
    const [appCols] = await db.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND COLUMN_NAME = 'testing_finished'
    `);
    if (appCols.length === 0) {
      await db.query(`ALTER TABLE applications ADD COLUMN testing_finished TINYINT(1) NOT NULL DEFAULT 0`);
      console.log('✅ Kolom testing_finished ditambahkan ke applications');
    } else {
      console.log('ℹ️  Kolom testing_finished sudah ada di aplikasi');
    }

    // 2. Pastikan kolom role ada di use_cases
    const [ucCols] = await db.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'use_cases' AND COLUMN_NAME = 'role'
    `);
    if (ucCols.length === 0) {
      await db.query(`ALTER TABLE use_cases ADD COLUMN role VARCHAR(100) NULL`);
      console.log('✅ Kolom role di use_cases ditambahkan');
    } else {
      console.log('ℹ️  Kolom role di use_cases sudah ada');
    }

    // 4. Cek dan tambahkan kolom assigned_role jika belum ada
    const [bugCols] = await db.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bugs' AND COLUMN_NAME = 'assigned_role'
    `);
    if (bugCols.length === 0) {
      await db.query(`ALTER TABLE bugs ADD COLUMN assigned_role VARCHAR(50) NULL`);
      console.log('✅ Kolom assigned_role ditambahkan ke bugs');
    } else {
      console.log('ℹ️  Kolom assigned_role sudah ada di bugs');
    }

    console.log('\n🎉 Migration selesai!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error migration:', err.message);
    process.exit(1);
  }
}

migrate();
