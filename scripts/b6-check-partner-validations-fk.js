const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkFK() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT conname, pg_get_constraintdef(oid) as definition
       FROM pg_constraint
       WHERE conrelid = 'partner_validations'::regclass
       AND contype = 'f'`
    );
    
    console.log('=== FOREIGN KEYS partner_validations ===\n');
    result.rows.forEach(row => {
      console.log(`${row.conname}: ${row.definition}`);
    });
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkFK();
