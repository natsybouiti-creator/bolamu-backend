const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function finalStats() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM zora_vouchers
         WHERE status = 'used') as vouchers_utilises,
        (SELECT COUNT(*) FROM zora_voucher_validations) as validations,
        (SELECT COUNT(*) FROM clearing_transactions
         WHERE reference_type = 'voucher') as clearing_vouchers,
        (SELECT COUNT(*) FROM zora_game_plays) as parties_jouees
    `);
    
    console.log('=== STATS FINALES B6 (OPTION A) ===\n');
    const row = result.rows[0];
    console.log(`vouchers_utilises: ${row.vouchers_utilises}`);
    console.log(`validations: ${row.validations}`);
    console.log(`clearing_vouchers: ${row.clearing_vouchers}`);
    console.log(`parties_jouees: ${row.parties_jouees}`);
    
    const allPositive = row.vouchers_utilises >= 1 && row.validations >= 1 && row.clearing_vouchers >= 1 && row.parties_jouees >= 1;
    console.log(`\n${allPositive ? '✓ PASS: Toutes les valeurs ≥ 1' : '❌ FAIL: Certaines valeurs restent à 0'}`);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

finalStats();
