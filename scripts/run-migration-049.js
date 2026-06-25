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
    const sql = fs.readFileSync('./database/migrations/migration_049_b5_clearing.sql', 'utf8');
    await client.query(sql);
    console.log('✓ Migration 049 exécutée avec succès');
  } catch (error) {
    console.error('❌ Erreur migration:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
