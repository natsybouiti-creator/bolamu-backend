const pool = require('../src/config/db');

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS zora_balance_visible_qr BOOLEAN DEFAULT false
    `);
    await client.query('COMMIT');
    console.log('✅ Migration 041 exécutée avec succès : zora_balance_visible_qr ajouté');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur migration 041:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error(err);
  process.exit(1);
});
