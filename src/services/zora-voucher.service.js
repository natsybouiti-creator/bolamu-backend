// ============================================================
// BOLAMU — Service Vouchers Zora (table zora_vouchers)
// Système UUID 8 chars, parallèle au marketplace partenaires (partner_vouchers).
// ============================================================
const crypto = require('crypto');
const pool = require('../config/db');
const { normalizePhone } = require('../utils/phone');
const { sendAutoMessage } = require('./whatsapp-web.service');

/**
 * Génère un code UUID 8 chars uppercase
 */
function generateCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * generateVoucher — Le patient échange des points Zora contre un voucher Zora.
 * @param {string} patient_phone
 * @param {number} reward_id
 * @returns {Promise<{ voucher_code, reward_name, expires_at }>}
 */
async function generateVoucher(patient_phone, reward_id) {
  const phone = normalizePhone(patient_phone);
  if (!phone) return { success: false, error: 'invalid_phone' };
  if (!reward_id) return { success: false, error: 'missing_reward_id' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Charger la reward (verrou pour le stock)
    const rewardResult = await client.query(
      `SELECT id, name, points_cost, partner_id, is_active
       FROM zora_rewards
       WHERE id = $1 AND is_active = TRUE
       FOR UPDATE`,
      [reward_id]
    );

    if (rewardResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'reward_not_found' };
    }

    const reward = rewardResult.rows[0];

    // 2. Vérifier le solde Zora
    const pointsResult = await client.query(
      'SELECT balance FROM zora_points WHERE phone = $1 FOR UPDATE',
      [phone]
    );

    if (pointsResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'no_zora_account' };
    }

    const balance = parseInt(pointsResult.rows[0].balance, 10) || 0;
    if (balance < reward.points_cost) {
      await client.query('ROLLBACK');
      return { success: false, error: 'insufficient_balance' };
    }

    // 3. Débit direct des points
    const debit = await client.query(
      `UPDATE zora_points
       SET balance = balance - $1, updated_at = NOW()
       WHERE phone = $2 AND balance >= $1`,
      [reward.points_cost, phone]
    );

    if (debit.rowCount === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'insufficient_balance' };
    }

    // 4. Ligne ledger négative
    await client.query(
      `INSERT INTO zora_ledger
       (phone, points, category, action_type, proof_class, proof_source, recording_method, proof_reference, verified, earned_at, expires_at)
       VALUES ($1, $2, 'redemption', 'voucher_redeem', 'system_event', 'zora_voucher', NULL, $3, TRUE, NOW(), NOW() + INTERVAL '12 months')`,
      [phone, -reward.points_cost, crypto.randomBytes(16).toString('hex')]
    );

    // 5. Générer le code UUID 8 chars
    const code = generateCode();

    // 6. Calculer expiration (48h)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    // 7. INSERT du voucher
    const voucherResult = await client.query(
      `INSERT INTO zora_vouchers
       (phone, reward_id, partner_id, points_spent, discount_value, status, issued_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, 'active', NOW(), $6)
       RETURNING id, uuid, code, status, expires_at`,
      [phone, reward_id, reward.partner_id, reward.points_cost, '100%', expiresAt]
    );

    const voucher = voucherResult.rows[0];

    // 8. Récupérer le nom du patient pour WhatsApp
    const userResult = await client.query(
      'SELECT first_name FROM users WHERE phone = $1',
      [phone]
    );
    const patientName = userResult.rows.length > 0 ? userResult.rows[0].first_name : 'Patient';

    // 9. Récupérer le nom du partenaire
    const partnerResult = await client.query(
      'SELECT name FROM zora_partners WHERE id = $1',
      [reward.partner_id]
    );
    const partnerName = partnerResult.rows.length > 0 ? partnerResult.rows[0].name : 'Partenaire';

    await client.query('COMMIT');

    // 10. Notifier patient WhatsApp
    setImmediate(async () => {
      try {
        await sendAutoMessage(phone, 'bolamu_voucher_genere', [
          patientName,
          code,
          partnerName
        ]);
      } catch (whatsappErr) {
        console.error('[ZORA VOUCHER] Erreur envoi WhatsApp (non bloquante):', whatsappErr.message);
      }
    });

    return {
      success: true,
      voucher_code: code,
      reward_name: reward.name,
      expires_at: voucher.expires_at
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[ZORA VOUCHER] Erreur generateVoucher:', error.message);
    return { success: false, error: 'server_error' };
  } finally {
    client.release();
  }
}

/**
 * validateVoucher — Un partenaire valide un voucher Zora.
 * @param {string} voucher_code
 * @param {string} partenaire_phone
 * @returns {Promise<{ success, patient_name, reward_name }>}
 */
async function validateVoucher(voucher_code, partenaire_phone) {
  const partnerPhone = normalizePhone(partenaire_phone);
  if (!voucher_code) return { success: false, error: 'missing_code' };
  if (!partnerPhone) return { success: false, error: 'invalid_phone' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Charger le voucher avec verrou
    const voucherResult = await client.query(
      `SELECT v.id, v.uuid, v.phone, v.reward_id, v.partner_id, v.status, v.expires_at, r.name as reward_name
       FROM zora_vouchers v
       JOIN zora_rewards r ON v.reward_id = r.id
       WHERE v.code = $1
       FOR UPDATE`,
      [voucher_code.toUpperCase()]
    );

    if (voucherResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'voucher_not_found' };
    }

    const voucher = voucherResult.rows[0];

    // 2. Idempotence : déjà utilisé
    if (voucher.status === 'used') {
      await client.query('ROLLBACK');
      return { success: false, error: 'voucher_already_used' };
    }

    // 3. Expiration
    if (voucher.status === 'expired' || (voucher.expires_at && new Date(voucher.expires_at) < new Date())) {
      if (voucher.status !== 'expired') {
        await client.query(
          "UPDATE zora_vouchers SET status = 'expired' WHERE id = $1",
          [voucher.id]
        );
      }
      await client.query('COMMIT');
      return { success: false, error: 'voucher_expired' };
    }

    if (voucher.status !== 'active') {
      await client.query('ROLLBACK');
      return { success: false, error: 'voucher_not_active' };
    }

    // 4. Vérifier partenaire autorisé
    const partnerResult = await client.query(
      'SELECT id FROM zora_partners WHERE phone = $1',
      [partnerPhone]
    );

    if (partnerResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'partner_not_authorized' };
    }

    const partnerId = partnerResult.rows[0].id;

    // 5. Marquer utilisé
    await client.query(
      `UPDATE zora_vouchers
       SET status = 'used', consumed_at = NOW(), consumed_by = $1
       WHERE id = $2`,
      [partnerPhone, voucher.id]
    );

    // 6. Journaliser la validation dans zora_voucher_validations
    await client.query(
      `INSERT INTO zora_voucher_validations (partner_phone, voucher_code, validated_at, amount_fcfa, method)
       VALUES ($1, $2, NOW(), $3, 'code_manual')`,
      [partnerPhone, voucher.uuid, fcfaValue]
    );

    // 7. Créer clearing transaction
    const rewardValueResult = await client.query(
      'SELECT fcfa_value FROM zora_rewards WHERE id = $1',
      [voucher.reward_id]
    );
    const fcfaValue = rewardValueResult.rows[0]?.fcfa_value || 0;

    if (fcfaValue > 0) {
      await client.query(
        `INSERT INTO clearing_transactions
         (partner_phone, partner_type, reference_id, reference_type, amount_fcfa, status)
         VALUES ($1, 'partenaire', $2, 'voucher', $3, 'pending')`,
        [partnerPhone, voucher.id, fcfaValue]
      );
    }

    // 8. Récupérer le nom du patient
    const userResult = await client.query(
      'SELECT first_name FROM users WHERE phone = $1',
      [voucher.phone]
    );
    const patientName = userResult.rows.length > 0 ? userResult.rows[0].first_name : 'Patient';

    // 9. Récupérer le nom du partenaire
    const partnerNameResult = await client.query(
      'SELECT name FROM zora_partners WHERE id = $1',
      [partnerId]
    );
    const partnerName = partnerNameResult.rows.length > 0 ? partnerNameResult.rows[0].name : 'Partenaire';

    await client.query('COMMIT');

    // 10. Notifier patient WhatsApp
    setImmediate(async () => {
      try {
        await sendAutoMessage(voucher.phone, 'bolamu_voucher_utilise', [
          patientName,
          voucher.reward_name,
          partnerName
        ]);
      } catch (whatsappErr) {
        console.error('[ZORA VOUCHER] Erreur envoi WhatsApp (non bloquante):', whatsappErr.message);
      }
    });

    return {
      success: true,
      patient_name: patientName,
      reward_name: voucher.reward_name
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[ZORA VOUCHER] Erreur validateVoucher:', error.message);
    return { success: false, error: 'server_error' };
  } finally {
    client.release();
  }
}

/**
 * getVouchersByPhone — Liste vouchers Zora du patient.
 * @param {string} phone
 * @returns {Promise<{ success, data }>}
 */
async function getVouchersByPhone(phone) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return { success: false, error: 'invalid_phone' };

  try {
    const result = await pool.query(
      `SELECT v.id, v.uuid, v.code, v.status, v.issued_at, v.expires_at, v.consumed_at,
              r.name as reward_name, r.points_cost, p.name as partner_name
       FROM zora_vouchers v
       JOIN zora_rewards r ON v.reward_id = r.id
       LEFT JOIN zora_partners p ON v.partner_id = p.id
       WHERE v.phone = $1
       ORDER BY v.issued_at DESC`,
      [normalizedPhone]
    );

    return {
      success: true,
      data: result.rows
    };
  } catch (error) {
    console.error('[ZORA VOUCHER] Erreur getVouchersByPhone:', error.message);
    return { success: false, error: 'server_error' };
  }
}

module.exports = {
  generateVoucher,
  validateVoucher,
  getVouchersByPhone
};
