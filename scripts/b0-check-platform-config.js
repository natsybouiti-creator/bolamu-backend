const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkPlatformConfig() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT config_key, config_value
      FROM platform_config
      ORDER BY config_key
    `);
    
    console.log('=== PLATFORM_CONFIG ===\n');
    if (result.rows.length === 0) {
      console.log('Aucune donnée');
    } else {
      result.rows.forEach(row => {
        console.log(`${row.config_key}: ${row.config_value}`);
      });
    }
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkPlatformConfig();
