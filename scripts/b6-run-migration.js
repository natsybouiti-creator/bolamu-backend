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
    const migrationSQL = fs.readFileSync('./migrations/b6_001_zora_voucher_validations.sql', 'utf8');
    await client.query(migrationSQL);
    console.log('✓ Migration B6-001 exécutée avec succès');
  } catch (error) {
    console.error('❌ Erreur migration:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
