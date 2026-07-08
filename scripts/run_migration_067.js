const pool = require('../src/config/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const migrationPath = path.join(__dirname, '../database/migrations/migration_067_private_accounts.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Exécution de la migration 067...');
    await client.query(migrationSQL);
    
    await client.query('COMMIT');
    console.log('✓ Migration 067 exécutée avec succès');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('✗ Erreur lors de la migration:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
