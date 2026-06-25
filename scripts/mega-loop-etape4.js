// MEGA LOOP - ÉTAPE 4 : Résultat → voucher partenaire → dette
require('dotenv').config();
const pool = require('../src/config/db');
const { sendAutoMessage } = require('../src/services/whatsapp-web.service');
const { normalizePhone } = require('../src/utils/phone');

const TEST_PHONE = '+242069735418'; // Numéro WhatsApp réel
const ALT_PHONE = '+242069735419'; // Numéro patient DB
const PARTNER_PHONE = '+242066226116'; // Pharmacie partenaire
const ZORA_COST = 50; // Coût en Zora

async function etape4() {
  console.log('[ÉTAPE 4] Résultat → voucher partenaire → dette');
  console.log('==============================================\n');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Vérifier solde Zora patient
    console.log('1. Vérification solde Zora patient...');
    const zoraRes = await client.query(
      `SELECT COALESCE(SUM(points), 0) as solde FROM zora_ledger WHERE phone = $1`,
      [ALT_PHONE]
    );
    
    const currentBalance = parseInt(zoraRes.rows[0].solde);
    console.log(`   Solde actuel : ${currentBalance} Zora\n`);
    
    if (currentBalance < ZORA_COST) {
      throw new Error(`Solde insuffisant : ${currentBalance} < ${ZORA_COST}`);
    }
    
    // 2. Créer reward Zora
    console.log('2. Création reward Zora...');
    const rewardRes = await client.query(
      `INSERT INTO zora_rewards
        (partner_id, title, description, points_cost, discount_value, discount_type, stock, valid_days, is_active, created_at)
       VALUES ((SELECT id FROM pharmacies WHERE phone = $1), $2, $3, $4, $5, $6, 100, 2, TRUE, NOW())
       RETURNING id`,
      [PARTNER_PHONE, 'Réduction Pharmacie MEGA LOOP', '15% de réduction sur médicaments', ZORA_COST, '15%', 'percentage']
    );
    
    const rewardId = rewardRes.rows[0].id;
    console.log(`   ✅ Reward créé (ID: ${rewardId})\n`);
    
    // 3. Générer voucher Zora
    console.log('3. Génération voucher Zora...');
    const voucherCode = `ZORA-${Date.now().toString(36).toUpperCase()}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 2); // Expire dans 48h
    
    const zoraVoucherRes = await client.query(
      `INSERT INTO zora_vouchers
        (uuid, phone, reward_id, partner_id, points_spent, discount_value, status, issued_at, expires_at)
       VALUES (gen_random_uuid(), $1, $2, (SELECT id FROM pharmacies WHERE phone = $3), $4, $5, 'active', NOW(), $6)
       RETURNING id, uuid`,
      [ALT_PHONE, rewardId, PARTNER_PHONE, ZORA_COST, '15%', expiresAt]
    );
    
    const zoraVoucherId = zoraVoucherRes.rows[0].id;
    const zoraVoucherUuid = zoraVoucherRes.rows[0].uuid;
    console.log(`   ✅ Voucher Zora créé (ID: ${zoraVoucherId}, Code: ${voucherCode})\n`);
    
    // 4. Débiter Zora
    console.log('4. Débit Zora...');
    const proofRef = `voucher-${zoraVoucherId}`;
    const zoraExpiresAt = new Date();
    zoraExpiresAt.setMonth(zoraExpiresAt.getMonth() + 6);
    
    await client.query(
      `INSERT INTO zora_ledger
        (phone, points, category, action_type, proof_class, proof_source, recording_method, proof_reference, verified, earned_at, expires_at)
       VALUES ($1, $2, 'redemption', 'voucher_redemption', 'zora_voucher', 'zora_marketplace', 'voucher_use', $3, true, NOW(), $4)`,
      [ALT_PHONE, -ZORA_COST, proofRef, zoraExpiresAt]
    );
    console.log(`   ✅ ${ZORA_COST} Zora débités\n`);
    
    // 5. Générer voucher partenaire
    console.log('5. Génération voucher partenaire...');
    const partnerVoucherCode = `PART-${Date.now().toString(36).toUpperCase()}`;
    const partnerExpiresAt = new Date();
    partnerExpiresAt.setDate(partnerExpiresAt.getDate() + 2);
    
    const partnerVoucherRes = await client.query(
      `INSERT INTO partner_vouchers
        (code, patient_phone, partner_id, zora_cost, fcfa_value, status, generated_at, expires_at, qr_payload)
       VALUES ($1, $2, (SELECT id FROM pharmacies WHERE phone = $3), $4, 5000, 'active', NOW(), $5, $6)
       RETURNING id`,
      [partnerVoucherCode, ALT_PHONE, PARTNER_PHONE, ZORA_COST, partnerExpiresAt, `{"voucher": "${partnerVoucherCode}", "value": 5000}`]
    );
    
    const partnerVoucherId = partnerVoucherRes.rows[0].id;
    console.log(`   ✅ Voucher partenaire créé (ID: ${partnerVoucherId})\n`);
    
    // 6. Partenaire valide le voucher
    console.log('6. Validation voucher par le partenaire...');
    await client.query(
      `UPDATE partner_vouchers
       SET status = 'used', used_at = NOW(), used_by = $1
       WHERE id = $2`,
      [PARTNER_PHONE, partnerVoucherId]
    );
    console.log('   ✅ Voucher validé\n');
    
    // 7. Enregistrer clearing/dette
    console.log('7. Enregistrement clearing...');
    const clearingRes = await client.query(
      `INSERT INTO partner_payouts
        (partner_phone, partner_type, period_start, period_end, member_count, amount_fcfa, status, created_at)
       VALUES ($1, 'pharmacie', NOW() - INTERVAL '1 month', NOW(), 1, 5000, 'pending', NOW())
       RETURNING id`,
      [PARTNER_PHONE]
    );
    
    const clearingId = clearingRes.rows[0].id;
    console.log(`   ✅ Clearing enregistré (ID: ${clearingId})\n`);
    
    await client.query('COMMIT');
    
    // 8. Vérifier nouveau solde Zora
    console.log('8. Vérification nouveau solde Zora...');
    const newZoraRes = await pool.query(
      `SELECT COALESCE(SUM(points), 0) as solde FROM zora_ledger WHERE phone = $1`,
      [ALT_PHONE]
    );
    
    console.log(`   Nouveau solde : ${newZoraRes.rows[0].solde} Zora\n`);
    
    // 9. Messages WhatsApp
    console.log('9. Envoi messages WhatsApp...\n');
    
    await sendAutoMessage(
      TEST_PHONE,
      'bolamu_voucher_genere',
      ['Patient Test', partnerVoucherCode, 'Pharmacie Mavré']
    );
    console.log('   ✅ Message voucher généré envoyé');
    
    await sendAutoMessage(
      TEST_PHONE,
      'bolamu_voucher_utilise',
      ['Patient Test', '15% de réduction', 'Pharmacie Mavré']
    );
    console.log('   ✅ Message voucher utilisé envoyé\n');
    
    console.log('=== ÉTAPE 4 TERMINÉE ===');
    console.log('SQL : ✓');
    console.log('WhatsApp : ✓');
    console.log('Reward ID :', rewardId);
    console.log('Zora voucher ID :', zoraVoucherId);
    console.log('Partner voucher ID :', partnerVoucherId);
    console.log('Clearing ID :', clearingId);
    console.log('Solde Zora final :', newZoraRes.rows[0].solde);
    console.log('========================\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur ÉTAPE 4:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

etape4()
  .then(() => console.log('ÉTAPE 4 : SUCCESS'))
  .catch(err => console.error('ÉTAPE 4 : FAIL', err))
  .finally(() => pool.end());
