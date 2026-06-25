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
    const migrationSQL = fs.readFileSync('./migrations/b7_001_icp_scores.sql', 'utf8');
    await client.query(migrationSQL);
    console.log('✓ Migration B7-001 exécutée avec succès');
  } catch (error) {
    console.error('❌ Erreur migration:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
