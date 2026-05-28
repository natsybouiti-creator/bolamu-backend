const pool = require('../src/config/db');
const fs = require('fs');

async function runMigration() {
  try {
    const sql = fs.readFileSync('./database/migration_027_symptoms.sql', 'utf8');
    await pool.query(sql);
    console.log('✅ Migration 027 exécutée avec succès');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur migration 027:', error.message);
    process.exit(1);
  }
}

runMigration();
