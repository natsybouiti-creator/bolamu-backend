const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkPatients() {
  try {
    const result = await pool.query(
      "SELECT phone, first_name FROM users WHERE role = 'patient' LIMIT 5"
    );
    console.log('Patients existants:');
    result.rows.forEach(u => console.log('  -', u.phone, ':', u.first_name));
  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await pool.end();
  }
}

checkPatients();
