const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkColumns() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT c.table_name, c.column_name, c.data_type
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
      AND c.table_name IN ('platform_config', 'partner_conventions', 'audit_log')
      ORDER BY c.table_name, c.ordinal_position
    `);
    
    console.log('=== COLONNES TABLES B0 ===\n');
    if (result.rows.length === 0) {
      console.log('Aucune colonne trouvée');
    } else {
      let currentTable = '';
      result.rows.forEach(row => {
        const tableName = row.table_name || 'unknown';
        if (tableName !== currentTable) {
          currentTable = tableName;
          console.log(`\n--- ${tableName} ---`);
        }
        console.log(`${row.column_name} (${row.data_type})`);
      });
    }
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkColumns();
