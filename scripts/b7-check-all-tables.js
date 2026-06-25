const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkAllTables() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_name ILIKE '%consent%'
      OR table_name ILIKE '%bhp%'
      OR table_name ILIKE '%wellness%'
      OR table_name ILIKE '%entreprise%'
      OR table_name ILIKE '%employe%'
      OR table_name ILIKE '%smartflow%'
      ORDER BY table_schema, table_name
    `);
    
    console.log('=== TABLES (TOUS SCHÉMAS) ===\n');
    if (result.rows.length === 0) {
      console.log('Aucune table trouvée');
    } else {
      result.rows.forEach(row => {
        console.log(`${row.table_schema}.${row.table_name}`);
      });
    }
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkAllTables();
