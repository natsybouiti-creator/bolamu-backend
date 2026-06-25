const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkConstraints() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT column_name, column_default, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public'
       AND table_name = 'zora_vouchers'
       ORDER BY ordinal_position`
    );
    
    console.log('=== CONTRAINTES zora_vouchers ===\n');
    result.rows.forEach(row => {
      console.log(`${row.column_name}:`);
      console.log(`  Default: ${row.column_default || 'NULL'}`);
      console.log(`  Nullable: ${row.is_nullable}`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkConstraints();
