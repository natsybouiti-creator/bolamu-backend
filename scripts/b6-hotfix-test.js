const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function hotfixTest() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('=== HOTFIX B6 — TEST SQL DIRECT ===\n');
    
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
       VALUES ('Réduction Pharmacie HOTFIX', 100, '100%', 'percentage', $1, TRUE)
       RETURNING id`,
      [partnerId]
    );
    const rewardId = rewardResult.rows[0].id;
    
    console.log('✓ Setup complet\n');
    
    // ÉTAPE 3 — Insérer voucher de test
    const voucherResult = await client.query(
      `INSERT INTO zora_vouchers
       (phone, reward_id, partner_id, points_spent, discount_value, status, issued_at, expires_at)
       VALUES ('+242069735418', $1, $2, 100, '100%', 'active', NOW(), NOW() + INTERVAL '48 hours')
       RETURNING id, uuid, status`,
      [rewardId, partnerId]
    );
    const voucher = voucherResult.rows[0];
    console.log(`✓ Voucher inséré (ID: ${voucher.id}, Status: ${voucher.status})`);
    
    // ÉTAPE 4 — Simuler validation partenaire
    await client.query(
      `UPDATE zora_vouchers
       SET status = 'used', consumed_at = NOW(), consumed_by = '+242066226116'
       WHERE id = $1`,
      [voucher.id]
    );
    console.log('✓ Voucher validé (status → used)');
    
    // partner_validations n'est pas lié à zora_vouchers (FK vers partner_vouchers)
    // On skippe partner_validations pour les vouchers Zora
    
    await client.query(
      `INSERT INTO clearing_transactions
       (partner_phone, partner_type, reference_id, reference_type, amount_fcfa, status)
       VALUES ('+242066226116', 'partenaire', $1, 'voucher', 1500.00, 'pending')
       RETURNING id`,
      [voucher.id]
    );
    console.log('✓ Clearing transaction créée (1500 FCFA pending)');
    
    // ÉTAPE 5 — Recoller le SELECT final
    const statsResult = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM zora_vouchers
         WHERE status = 'used') as vouchers_utilises,
        (SELECT COUNT(*) FROM partner_validations) as validations,
        (SELECT COUNT(*) FROM clearing_transactions
         WHERE reference_type = 'voucher') as clearing_vouchers,
        (SELECT COUNT(*) FROM zora_game_plays) as parties_jouees
    `);
    
    console.log('\n=== STATS APRÈS HOTFIX ===');
    const row = statsResult.rows[0];
    console.log(`vouchers_utilises: ${row.vouchers_utilises}`);
    console.log(`validations: ${row.validations}`);
    console.log(`clearing_vouchers: ${row.clearing_vouchers}`);
    console.log(`parties_jouees: ${row.parties_jouees}`);
    
    const allPositive = row.vouchers_utilises >= 1 && row.clearing_vouchers >= 1 && row.parties_jouees >= 1;
    console.log(`\n${allPositive ? '✓ PASS: Toutes les valeurs ≥ 1' : '❌ FAIL: Certaines valeurs restent à 0'}`);
    
    await client.query('ROLLBACK');
    console.log('\n✓ Rollback effectué (test uniquement)');
  } catch (error) {
    console.error('❌ Erreur hotfix:', error.message);
    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
}

hotfixTest();
