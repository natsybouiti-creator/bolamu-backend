const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkCompanyContracts() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND (table_name ILIKE '%company%'
      OR table_name ILIKE '%contract%'
      OR table_name ILIKE '%entreprise%')
      ORDER BY table_name
    `);
    
    console.log('=== TABLES COMPANY/CONTRACT/ENTREPRISE ===\n');
    if (result.rows.length === 0) {
      console.log('Aucune table trouvée');
    } else {
      result.rows.forEach(row => {
        console.log(row.table_name);
      });
    }
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkCompanyContracts();
