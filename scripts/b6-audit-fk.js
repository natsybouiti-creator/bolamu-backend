const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function auditFK() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table,
        ccu.column_name AS foreign_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'partner_validations'
      AND tc.constraint_type = 'FOREIGN KEY'
    `);
    
    console.log('=== AUDIT FK partner_validations ===\n');
    if (result.rows.length === 0) {
      console.log('Aucune FK trouvée sur partner_validations');
    } else {
      result.rows.forEach(row => {
        console.log(`${row.constraint_name}: ${row.column_name} → ${row.foreign_table}.${row.foreign_column}`);
      });
    }
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

auditFK();
