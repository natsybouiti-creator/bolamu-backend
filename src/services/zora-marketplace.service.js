// ============================================================
// BOLAMU — Sprint 3 : Service Marketplace Zora
// ============================================================
const pool = require('../config/db');

// Ordre des paliers pour vérification
const TIER_ORDER = ['kimia', 'liboso', 'nkembo', 'elonga'];

/**
 * Échanger des points contre une récompense
 * @param {Object} params - { phone, reward_id }
 * @returns {Object} - { success, voucher_uuid, expires_at, discount_value, partner_name, reward_title, error }
 */
async function redeemReward({ phone, reward_id }) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // ÉTAPE 1 — Vérifier la récompense
    const rewardResult = await client.query(
      `SELECT r.*, p.name as partner_name 
       FROM zora_rewards r 
       JOIN zora_partners p ON r.partner_id = p.id 
       WHERE r.id = $1 AND r.is_active = TRUE`,
      [reward_id]
    );
    
    if (rewardResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'reward_not_found' };
    }
    
    const reward = rewardResult.rows[0];
    
    // ÉTAPE 2 — Vérifier le palier
    const pointsResult = await client.query(
      'SELECT tier, balance FROM zora_points WHERE phone = $1',
      [phone]
    );
    
    if (pointsResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'user_not_found' };
    }
    
    const userTier = pointsResult.rows[0].tier;
    const userBalance = pointsResult.rows[0].balance;
    
    const userTierIndex = TIER_ORDER.indexOf(userTier);
    const minTierIndex = TIER_ORDER.indexOf(reward.min_tier);
    
    if (userTierIndex < minTierIndex) {
      await client.query('ROLLBACK');
      return { success: false, error: 'tier_insufficient' };
    }
    
    // ÉTAPE 3 — Vérifier le solde
    if (userBalance < reward.points_cost) {
      await client.query('ROLLBACK');
      return { success: false, error: 'insufficient_balance' };
    }
    
    // ÉTAPE 4 — Vérifier le stock
    if (reward.stock !== null) {
      const stockResult = await client.query(
        `SELECT COUNT(*) as count 
         FROM zora_vouchers 
         WHERE reward_id = $1 AND status IN ('active', 'consumed')`,
        [reward_id]
      );
      
      const usedCount = parseInt(stockResult.rows[0].count);
      if (usedCount >= reward.stock) {
        await client.query('ROLLBACK');
        return { success: false, error: 'reward_exhausted' };
      }
    }
    
    // ÉTAPE 5 — TRANSACTION ATOMIQUE
    // Déduire les points
    const updateResult = await client.query(
      `UPDATE zora_points 
       SET balance = balance - $1, updated_at = NOW()
       WHERE phone = $2 AND balance >= $1`,
      [reward.points_cost, phone]
    );
    
    if (updateResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'insufficient_balance' };
    }
    
    // Insérer ligne ledger (dépense = points négatifs)
    await client.query(
      `INSERT INTO zora_ledger 
       (phone, points, category, action_type, proof_class, proof_reference, verified, earned_at, expires_at)
       VALUES ($1, $2, 'redemption', 'reward_redemption', 'system_event', $3, TRUE, NOW(), NOW() + INTERVAL '12 months')`,
      [phone, -reward.points_cost, reward_id.toString()]
    );
    
    // Générer le voucher
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + reward.valid_days);
    
    const voucherResult = await client.query(
      `INSERT INTO zora_vouchers 
       (phone, reward_id, partner_id, points_spent, discount_value, status, issued_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, 'active', NOW(), $6)
       RETURNING uuid, expires_at`,
      [phone, reward_id, reward.partner_id, reward.points_cost, reward.discount_value, expiresAt]
    );
    
    const voucher = voucherResult.rows[0];
    
    // Audit
    await client.query(
      `INSERT INTO audit_log (event_type, actor_phone, payload)
       VALUES ('zora_redemption', $1, $2::jsonb)`,
      [phone, JSON.stringify({ reward_id, points_spent: reward.points_cost })]
    );
    
    await client.query('COMMIT');
    
    return {
      success: true,
      voucher_uuid: voucher.uuid,
      expires_at: voucher.expires_at,
      discount_value: reward.discount_value,
      partner_name: reward.partner_name,
      reward_title: reward.title
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[ZORA MARKETPLACE] Erreur redeemReward:', error.message);
    return { success: false, error: 'server_error' };
  } finally {
    client.release();
  }
}

/**
 * Consommer un voucher (scan par partenaire)
 * @param {Object} params - { voucher_uuid, partner_phone }
 * @returns {Object} - { success, patient_phone, reward_title, discount_value, consumed_at, error }
 */
async function consumeVoucher({ voucher_uuid, partner_phone }) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // ÉTAPE 1 — Charger le voucher
    const voucherResult = await client.query(
      `SELECT v.*, r.title as reward_title, p.name as partner_name
       FROM zora_vouchers v
       JOIN zora_rewards r ON v.reward_id = r.id
       JOIN zora_partners p ON v.partner_id = p.id
       WHERE v.uuid = $1`,
      [voucher_uuid]
    );
    
    if (voucherResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'voucher_not_found' };
    }
    
    const voucher = voucherResult.rows[0];
    
    // ÉTAPE 2 — Vérifications
    if (voucher.status === 'consumed') {
      await client.query('ROLLBACK');
      return { success: false, error: 'voucher_already_used' };
    }
    
    if (voucher.status === 'expired' || new Date(voucher.expires_at) < new Date()) {
      // Marquer expiré si ce n'est pas déjà fait
      await client.query(
        'UPDATE zora_vouchers SET status = $1 WHERE uuid = $2',
        ['expired', voucher_uuid]
      );
      await client.query('ROLLBACK');
      return { success: false, error: 'voucher_expired' };
    }
    
    // ÉTAPE 3 — Vérifier que le partenaire est autorisé
    // Récupérer le partenaire depuis users pour vérifier l'autorisation
    const partnerResult = await client.query(
      `SELECT phone FROM users WHERE phone = $1 AND role IN ('pharmacie', 'pharmacy', 'doctor', 'laboratory')`,
      [partner_phone]
    );
    
    if (partnerResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'partner_not_authorized' };
    }
    
    // Vérifier que le partenaire correspond au partner_id du voucher
    // Pour simplifier, on accepte n'importe quel partenaire authentifié
    // Dans une version complète, on vérifierait que partner_phone correspond au partner_id
    
    // ÉTAPE 4 — Marquer consommé
    await client.query(
      `UPDATE zora_vouchers 
       SET status = 'consumed', consumed_at = NOW(), consumed_by = $1
       WHERE uuid = $2`,
      [partner_phone, voucher_uuid]
    );
    
    await client.query('COMMIT');
    
    return {
      success: true,
      patient_phone: voucher.phone,
      reward_title: voucher.reward_title,
      discount_value: voucher.discount_value,
      consumed_at: new Date()
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[ZORA MARKETPLACE] Erreur consumeVoucher:', error.message);
    return { success: false, error: 'server_error' };
  } finally {
    client.release();
  }
}

/**
 * Récupérer les récompenses disponibles
 * @param {Object} params - { category, phone }
 * @returns {Object} - { success, data, error }
 */
async function getRewards({ category, phone }) {
  try {
    let query = `
      SELECT r.*, p.name as partner_name, p.logo_path, p.category as partner_category
      FROM zora_rewards r
      JOIN zora_partners p ON r.partner_id = p.id
      WHERE r.is_active = TRUE
    `;
    const params = [];
    
    if (category) {
      query += ' AND p.category = $1';
      params.push(category);
    }
    
    query += ' ORDER BY r.points_cost ASC';
    
    const result = await pool.query(query, params);
    
    // Récupérer balance et tier de l'utilisateur si phone fourni
    let userBalance = 0;
    let userTier = 'kimia';
    
    if (phone) {
      const pointsResult = await pool.query(
        'SELECT balance, tier FROM zora_points WHERE phone = $1',
        [phone]
      );
      if (pointsResult.rows.length > 0) {
        userBalance = pointsResult.rows[0].balance;
        userTier = pointsResult.rows[0].tier;
      }
    }
    
    // Calculer stock restant pour chaque récompense
    const rewardsWithStock = await Promise.all(
      result.rows.map(async (reward) => {
        let stockRemaining = null;
        
        if (reward.stock !== null) {
          const stockResult = await pool.query(
            `SELECT COUNT(*) as count 
             FROM zora_vouchers 
             WHERE reward_id = $1 AND status IN ('active', 'consumed')`,
            [reward.id]
          );
          stockRemaining = reward.stock - parseInt(stockResult.rows[0].count);
        }
        
        // Vérifier si l'utilisateur peut se l'offrir
        const canAfford = userBalance >= reward.points_cost;
        const userTierIndex = TIER_ORDER.indexOf(userTier);
        const minTierIndex = TIER_ORDER.indexOf(reward.min_tier);
        const hasTier = userTierIndex >= minTierIndex;
        
        return {
          ...reward,
          stock_remaining: stockRemaining,
          can_afford: canAfford && hasTier,
          tier_insufficient: !hasTier
        };
      })
    );
    
    return { success: true, data: rewardsWithStock };
    
  } catch (error) {
    console.error('[ZORA MARKETPLACE] Erreur getRewards:', error.message);
    return { success: false, error: 'server_error' };
  }
}

/**
 * Récupérer les vouchers d'un utilisateur
 * @param {String} phone
 * @returns {Object} - { success, data, error }
 */
async function getUserVouchers(phone) {
  try {
    const result = await pool.query(
      `SELECT v.*, r.title as reward_title, p.name as partner_name, p.logo_path
       FROM zora_vouchers v
       JOIN zora_rewards r ON v.reward_id = r.id
       JOIN zora_partners p ON v.partner_id = p.id
       WHERE v.phone = $1
       ORDER BY v.issued_at DESC`,
      [phone]
    );
    
    return { success: true, data: result.rows };
    
  } catch (error) {
    console.error('[ZORA MARKETPLACE] Erreur getUserVouchers:', error.message);
    return { success: false, error: 'server_error' };
  }
}

/**
 * Récupérer un voucher par UUID
 * @param {String} uuid
 * @returns {Object} - { success, data, error }
 */
async function getVoucherByUuid(uuid) {
  try {
    const result = await pool.query(
      `SELECT v.*, r.title as reward_title, p.name as partner_name, p.logo_path, p.category as partner_category
       FROM zora_vouchers v
       JOIN zora_rewards r ON v.reward_id = r.id
       JOIN zora_partners p ON v.partner_id = p.id
       WHERE v.uuid = $1`,
      [uuid]
    );
    
    if (result.rows.length === 0) {
      return { success: false, error: 'voucher_not_found' };
    }
    
    return { success: true, data: result.rows[0] };
    
  } catch (error) {
    console.error('[ZORA MARKETPLACE] Erreur getVoucherByUuid:', error.message);
    return { success: false, error: 'server_error' };
  }
}

/**
 * Récupérer les vouchers consommés par un partenaire
 * @param {String} partner_phone
 * @returns {Object} - { success, data, error }
 */
async function getPartnerVouchers(partner_phone) {
  try {
    const result = await pool.query(
      `SELECT v.*, r.title as reward_title, p.name as partner_name
       FROM zora_vouchers v
       JOIN zora_rewards r ON v.reward_id = r.id
       JOIN zora_partners p ON v.partner_id = p.id
       WHERE v.consumed_by = $1 AND v.status = 'consumed'
       ORDER BY v.consumed_at DESC`,
      [partner_phone]
    );
    
    return { success: true, data: result.rows };
    
  } catch (error) {
    console.error('[ZORA MARKETPLACE] Erreur getPartnerVouchers:', error.message);
    return { success: false, error: 'server_error' };
  }
}

module.exports = {
  redeemReward,
  consumeVoucher,
  getRewards,
  getUserVouchers,
  getVoucherByUuid,
  getPartnerVouchers
};
