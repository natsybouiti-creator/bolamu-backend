const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function auditTables() {
  try {
    const result = await pool.query(
      `SELECT column_name, data_type 
       FROM information_schema.columns
       WHERE table_schema = 'public' 
       AND table_name IN ('file_attente', 'prescriptions', 
                          'health_records', 'documents')
       ORDER BY table_name, ordinal_position`
    );

    console.log('=== AUDIT TABLES EXISTANTES ===\n');
    let currentTable = '';
    result.rows.forEach(row => {
      if (row.table_name !== currentTable) {
        currentTable = row.table_name;
        console.log(`\n--- ${currentTable} ---`);
      }
      console.log(`  ${row.column_name} : ${row.data_type}`);
    });
  } catch (error) {
    console.error('❌ Erreur audit:', error.message);
  } finally {
    await pool.end();
  }
}

auditTables();
