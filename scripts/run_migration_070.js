const pool = require('../src/config/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const migrationPath = path.join(__dirname, '../database/migrations/migration_070_notifications_whatsapp_image_type.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Exécution de la migration 070...');
    await client.query(migrationSQL);

    await client.query('COMMIT');
    console.log('✓ Migration 070 exécutée avec succès');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('✗ Erreur lors de la migration:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch((err) => {
  console.error(err);
  process.exit(1);
});
