const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function auditColumns() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT table_name, column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public'
       AND table_name IN (
         'zora_vouchers', 'zora_games', 'zora_game_plays',
         'partner_vouchers', 'partner_validations'
       )
       ORDER BY table_name, ordinal_position`
    );
    
    console.log('=== AUDIT COLONNES TABLES B6 ===\n');
    let currentTable = '';
    result.rows.forEach(row => {
      if (row.table_name !== currentTable) {
        if (currentTable) console.log('');
        currentTable = row.table_name;
        console.log(`Table: ${row.table_name}`);
      }
      console.log(`  ${row.column_name} (${row.data_type})`);
    });
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

auditColumns();
