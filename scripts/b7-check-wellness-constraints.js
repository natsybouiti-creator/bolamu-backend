const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkConstraints() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT cc.check_clause
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
      WHERE tc.table_name = 'wellness_actions'
      AND tc.constraint_type = 'CHECK'
    `);
    
    console.log('=== CHECK CONSTRAINTS wellness_actions ===\n');
    result.rows.forEach(row => {
      console.log(row.check_clause);
    });
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkConstraints();
