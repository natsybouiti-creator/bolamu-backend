const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkColumns() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public'
       AND table_name = 'zora_ledger'
       ORDER BY ordinal_position`
    );
    
    console.log('=== COLONNES zora_ledger ===\n');
    result.rows.forEach(row => {
      console.log(`${row.column_name} (${row.data_type})`);
    });
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkColumns();
