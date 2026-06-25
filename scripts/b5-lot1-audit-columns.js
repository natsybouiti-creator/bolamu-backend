const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function auditColumns() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name IN (
        'pharmacies', 'laboratories',
        'lab_prescriptions', 'lab_results',
        'partner_zones', 'partner_payouts',
        'partner_conventions'
      )
      ORDER BY table_name, ordinal_position
    `);
    
    console.log('=== AUDIT COLONNES TABLES B5 ===\n');
    let currentTable = '';
    result.rows.forEach(row => {
      if (row.table_name !== currentTable) {
        currentTable = row.table_name;
        console.log(`\n--- ${currentTable} ---`);
      }
      console.log(`  ${row.column_name} (${row.data_type}) ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    console.log(`\nTotal colonnes: ${result.rows.length}`);
  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

auditColumns();
