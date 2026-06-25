const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    const sql = fs.readFileSync('database/migrations/migration_046_leaderboard_social.sql', 'utf8');
    await pool.query(sql);
    console.log('✓ Migration 046 exécutée avec succès');
  } catch (error) {
    console.error('❌ Erreur migration:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
