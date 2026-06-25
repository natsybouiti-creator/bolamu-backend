const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function getStats() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM zora_vouchers
         WHERE status = 'used') as vouchers_utilises,
        (SELECT COUNT(*) FROM partner_validations) as validations,
        (SELECT COUNT(*) FROM clearing_transactions
         WHERE reference_type = 'voucher') as clearing_vouchers,
        (SELECT COUNT(*) FROM zora_game_plays) as parties_jouees
    `);
    
    console.log('=== STATS B6 (NEON) ===\n');
    const row = result.rows[0];
    console.log(`vouchers_utilises: ${row.vouchers_utilises}`);
    console.log(`validations: ${row.validations}`);
    console.log(`clearing_vouchers: ${row.clearing_vouchers}`);
    console.log(`parties_jouees: ${row.parties_jouees}`);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

getStats();
