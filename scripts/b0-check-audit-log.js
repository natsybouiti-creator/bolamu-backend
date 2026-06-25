const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkAuditLog() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT COUNT(*) as total,
             MAX(created_at) as dernier_log
      FROM audit_log
    `);
    
    console.log('=== AUDIT_LOG ===\n');
    const row = result.rows[0];
    console.log(`total: ${row.total}`);
    console.log(`dernier_log: ${row.dernier_log}`);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkAuditLog();
