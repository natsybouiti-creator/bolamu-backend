const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();
  try {
    const migrationSQL = fs.readFileSync(
      './database/migrations/migration_047_animateurs_elonga_points.sql',
      'utf8'
    );
    
    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');
    
    console.log('✅ Migration 047 exécutée avec succès');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur migration:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
