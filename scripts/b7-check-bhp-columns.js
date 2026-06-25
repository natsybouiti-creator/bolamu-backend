const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkColumns() {
  const client = await pool.connect();
  try {
    console.log('=== COLONNES bhp_consents ===\n');
    const bhpResult = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public'
       AND table_name = 'bhp_consents'
       ORDER BY ordinal_position`
    );
    bhpResult.rows.forEach(row => console.log(row.column_name));
    
    console.log('\n=== COLONNES wellness_scores ===\n');
    const wellnessResult = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public'
       AND table_name = 'wellness_scores'
       ORDER BY ordinal_position`
    );
    wellnessResult.rows.forEach(row => console.log(row.column_name));
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkColumns();
