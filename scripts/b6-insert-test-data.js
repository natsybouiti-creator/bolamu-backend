const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function insertTestData() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('=== INSERT TEST DATA B6 (NO ROLLBACK) ===\n');
    
    // Setup
    await client.query(
      `INSERT INTO users (phone, password_hash, role, is_active, first_name, full_name)
       VALUES ('+242069735418', '$2b$10$test', 'patient', TRUE, 'Antonio', 'Antonio Test')
       ON CONFLICT (phone) DO UPDATE SET first_name = 'Antonio', full_name = 'Antonio Test'`
    );
    
    const partnerResult = await client.query(
      `SELECT id FROM pharmacies WHERE phone = '+242066226116'`
    );
    const partnerId = partnerResult.rows.length > 0 ? partnerResult.rows[0].id : 1;
    
    const rewardResult = await client.query(
      `INSERT INTO zora_rewards (title, points_cost, discount_value, discount_type, partner_id, is_active)
       VALUES ('Réduction Pharmacie TEST', 100, '100%', 'percentage', $1, TRUE)
       RETURNING id`,
      [partnerId]
    );
    const rewardId = rewardResult.rows[0].id;
    
    // Insérer voucher
    const voucherResult = await client.query(
      `INSERT INTO zora_vouchers
       (phone, reward_id, partner_id, points_spent, discount_value, status, issued_at, expires_at)
       VALUES ('+242069735418', $1, $2, 100, '100%', 'active', NOW(), NOW() + INTERVAL '48 hours')
       RETURNING id, uuid, status`,
      [rewardId, partnerId]
    );
    const voucher = voucherResult.rows[0];
    console.log(`✓ Voucher inséré (ID: ${voucher.id}, UUID: ${voucher.uuid})`);
    
    // Valider voucher
    await client.query(
      `UPDATE zora_vouchers
       SET status = 'used', consumed_at = NOW(), consumed_by = '+242066226116'
       WHERE id = $1`,
      [voucher.id]
    );
    console.log('✓ Voucher validé');
    
    // Insérer validation
    await client.query(
      `INSERT INTO zora_voucher_validations (partner_phone, voucher_code, validated_at, amount_fcfa, method)
       VALUES ('+242066226116', $1, NOW(), 1500.00, 'code_manual')`,
      [voucher.uuid]
    );
    console.log('✓ Validation insérée');
    
    // Insérer clearing transaction
    await client.query(
      `INSERT INTO clearing_transactions
       (partner_phone, partner_type, reference_id, reference_type, amount_fcfa, status)
       VALUES ('+242066226116', 'partenaire', $1, 'voucher', 1500.00, 'pending')`,
      [voucher.id]
    );
    console.log('✓ Clearing transaction insérée');
    
    await client.query('COMMIT');
    console.log('\n✓ COMMIT effectué (données persistées)');
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
}

insertTestData();
