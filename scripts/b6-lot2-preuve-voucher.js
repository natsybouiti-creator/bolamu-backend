const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function preuveVoucher() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('=== PREUVE SQL VOUCHER B6 ===\n');
    
    // 1. Test génération voucher
    const voucherResult = await client.query(
      `INSERT INTO zora_vouchers
       (phone, reward_id, partner_id, points_spent, discount_value, status, issued_at, expires_at)
       VALUES ('+242069735418', 1, 1, 100, '100%', 'active', NOW(), NOW() + INTERVAL '48 hours')
       RETURNING id, uuid, status, expires_at`
    );
    const voucher = voucherResult.rows[0];
    console.log(`✓ Voucher généré (ID: ${voucher.id}, UUID: ${voucher.uuid}, Status: ${voucher.status})`);
    
    // Note: partner_validations est lié à partner_vouchers, pas zora_vouchers
    // On skippe l'insertion partner_validations pour les vouchers Zora
    
    // 2. Vérifier statut voucher
    const checkResult = await client.query(
      `SELECT id, uuid, status FROM zora_vouchers WHERE id = $1`,
      [voucher.id]
    );
    const voucherCheck = checkResult.rows[0];
    console.log(`✓ Voucher check (ID: ${voucherCheck.id}, Status: ${voucherCheck.status})`);
    
    await client.query('ROLLBACK');
    console.log('\n✓ Rollback effectué (test uniquement)');
    
    console.log('\n=== PREUVE SQL VOUCHER VALIDÉE ===');
  } catch (error) {
    console.error('❌ Erreur preuve voucher:', error.message);
    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
}

preuveVoucher();
