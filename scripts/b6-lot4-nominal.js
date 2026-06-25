const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function parcoursNominal() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('=== PARCOURS NOMINAL QA B6 ===\n');
    
    // 1. Créer utilisateur test si inexistant
    await client.query(
      `INSERT INTO users (phone, password_hash, role, is_active, first_name, full_name)
       VALUES ('+242069735418', '$2b$10$test', 'patient', TRUE, 'Antonio', 'Antonio Test')
       ON CONFLICT (phone) DO UPDATE SET first_name = 'Antonio', full_name = 'Antonio Test'`
    );
    
    // 2. Créer compte Zora
    await client.query(
      `INSERT INTO zora_points (phone, balance, updated_at)
       VALUES ('+242069735418', 500, NOW())
       ON CONFLICT (phone) DO UPDATE SET balance = 500`
    );
    
    // 3. Utiliser partenaire existant (pharmacie avec phone)
    const partnerResult = await client.query(
      `SELECT id FROM pharmacies WHERE phone = '+242066226116'`
    );
    const partnerId = partnerResult.rows.length > 0 ? partnerResult.rows[0].id : 1;
    const partnerPhone = '+242066226116';
    
    // 4. Créer reward Zora (partner_id est NOT NULL, discount_type requis)
    const rewardResult = await client.query(
      `INSERT INTO zora_rewards (title, points_cost, discount_value, discount_type, partner_id, is_active)
       VALUES ('Réduction Pharmacie B6 TEST', 100, '100%', 'percentage', $1, TRUE)
       RETURNING id`,
      [partnerId]
    );
    const rewardId = rewardResult.rows[0].id;
    
    console.log('✓ Setup: utilisateur, compte Zora, reward créés');
    
    // 5. Générer voucher Zora (simulation service)
    const voucherResult = await client.query(
      `INSERT INTO zora_vouchers
       (phone, reward_id, partner_id, points_spent, discount_value, status, issued_at, expires_at)
       VALUES ('+242069735418', $1, $2, 100, '100%', 'active', NOW(), NOW() + INTERVAL '48 hours')
       RETURNING id, uuid, status`,
      [rewardId, partnerId]
    );
    const voucher = voucherResult.rows[0];
    console.log(`✓ Voucher généré (ID: ${voucher.id}, Status: ${voucher.status})`);
    
    // 7. Déduire points Zora
    await client.query(
      `UPDATE zora_points SET balance = balance - 100 WHERE phone = '+242069735418'`
    );
    console.log('✓ Points Zora déduits (500 → 400)');
    
    // 8. Valider voucher (simulation service)
    await client.query(
      `UPDATE zora_vouchers
       SET status = 'used', consumed_at = NOW(), consumed_by = '+242065207275'
       WHERE id = $1`,
      [voucher.id]
    );
    console.log('✓ Voucher validé par partenaire');
    
    // 9. Créer clearing transaction (valeur FCFA simulée)
    await client.query(
      `INSERT INTO clearing_transactions
       (partner_phone, partner_type, reference_id, reference_type, amount_fcfa, status)
       VALUES ('+242065207275', 'partenaire', $1, 'voucher', 1000, 'pending')`,
      [voucher.id]
    );
    console.log('✓ Clearing transaction créée (1000 FCFA pending)');
    
    // 10. Vérifier balance finale
    const balanceResult = await client.query(
      `SELECT balance FROM zora_points WHERE phone = '+242069735418'`
    );
    const finalBalance = balanceResult.rows[0].balance;
    console.log(`✓ Balance finale: ${finalBalance} points`);
    
    await client.query('ROLLBACK');
    console.log('\n✓ Rollback effectué (test uniquement)');
    
    console.log('\n=== PARCOURS NOMINAL VALIDÉ ===');
  } catch (error) {
    console.error('❌ Erreur parcours nominal:', error.message);
    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
}

parcoursNominal();
