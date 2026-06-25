const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkOrdonnances() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'ordonnances'
      ORDER BY ordinal_position
    `);
    
    console.log('=== COLONNES TABLE ORDONNANCES (B4) ===');
    result.rows.forEach(row => {
      console.log(`${row.column_name} (${row.data_type}) ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkOrdonnances();
