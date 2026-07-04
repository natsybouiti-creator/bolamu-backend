// ============================================================
// BOLAMU — Sprint 2 : Service Zora Points
// ============================================================
const pool = require('../config/db');
const chatService = require('./chat.service');
const { updateStreak } = require('./streak.service');

// Cache tiers config (table statique — TTL 5 min)
// Cache 5 min : après modification d'un palier en base, le changement met jusqu'à 5 min
// à être pris en compte (acceptable car config rarement modifiée).
let _tiersCache = null;
let _tiersCacheAt = 0;
async function getTiersConfig() {
  if (_tiersCache && Date.now() - _tiersCacheAt < 5 * 60 * 1000) return _tiersCache;
  const res = await pool.query('SELECT * FROM zora_tiers_config WHERE is_active = TRUE ORDER BY min_points');
  _tiersCache = res.rows;
  _tiersCacheAt = Date.now();
  return _tiersCache;
}

/**
 * Fonction principale awardZora
 * Crédite des points Zora à un utilisateur selon les règles et la taxonomie de preuve
 * 
 * @param {Object} params - Paramètres du crédit
 * @param {string} params.phone - Numéro de téléphone de l'utilisateur
 * @param {string} params.action_type - Type d'action (ex: 'consultation', 'analyse_labo')
 * @param {string} params.proof_class - Classe de preuve (ground_truth, system_event, device_measured, device_declared)
 * @param {string} params.proof_source - Source de la preuve (praticien, partenaire, device...)
 * @param {string|null} params.recording_method - Méthode d'enregistrement (auto_recorded, actively_recorded, manual_entry)
 * @param {string} params.proof_reference - Référence unique de la preuve (appointment_id, lab_result_id...)
 * @returns {Promise<Object>} Résultat du crédit
 */
async function awardZora({ phone, action_type, proof_class, proof_source, recording_method, proof_reference }) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // ÉTAPE 1 — Charger la règle depuis zora_earn_rules
    const ruleResult = await client.query(
      'SELECT * FROM zora_earn_rules WHERE action_type = $1',
      [action_type]
    );
    
    if (ruleResult.rows.length === 0) {
      console.log(`[ZORA] Règle inconnue pour action_type: ${action_type}`);
      await client.query('ROLLBACK');
      return { success: false, reason: 'rule_unknown' };
    }
    
    const rule = ruleResult.rows[0];
    
    // Si is_active = FALSE → refus silencieux
    if (!rule.is_active) {
      console.log(`[ZORA] Règle inactive pour action_type: ${action_type} (phase: ${rule.phase})`);
      await client.query('ROLLBACK');
      return { success: false, reason: 'rule_inactive' };
    }
    
    // ÉTAPE 2 — CONTRÔLE DE PREUVE (ordre strict)
    
    // Si proof_class = 'device_declared' → REJET TOTAL
    if (proof_class === 'device_declared') {
      console.log(`[ZORA] Rejet device_declared pour phone: ${phone}, action: ${action_type}`);
      await client.query('ROLLBACK');
      return { success: false, reason: 'proof_declared_rejected' };
    }
    
    // Si proof_class fourni inférieur à required_proof_class de la règle → REJET
    const proofHierarchy = {
      'ground_truth': 3,
      'system_event': 2,
      'device_measured': 1,
      'device_declared': 0
    };
    
    if (proofHierarchy[proof_class] < proofHierarchy[rule.required_proof_class]) {
      console.log(`[ZORA] Preuve insuffisante pour phone: ${phone}, action: ${action_type}. Requis: ${rule.required_proof_class}, Fourni: ${proof_class}`);
      await client.query('ROLLBACK');
      return { success: false, reason: 'proof_insufficient' };
    }
    
    // Si proof_class = 'device_measured' ET recording_method = 'manual_entry' → REJET
    if (proof_class === 'device_measured' && recording_method === 'manual_entry') {
      console.log(`[ZORA] Rejet device_measured avec manual_entry pour phone: ${phone}, action: ${action_type}`);
      await client.query('ROLLBACK');
      return { success: false, reason: 'proof_manual_rejected' };
    }
    
    // ÉTAPES 3-5 — Idempotence + plafonds en un seul aller-retour Neon
    const vRes = await client.query(
      `SELECT
        (SELECT COUNT(*) FROM zora_ledger
         WHERE action_type = $1 AND proof_reference = $2 AND points > 0)               AS already_credited,
        (SELECT COUNT(*) FROM zora_ledger
         WHERE phone = $3 AND action_type = $1 AND earned_at >= CURRENT_DATE)           AS today_count,
        (SELECT COALESCE(SUM(points), 0) FROM zora_ledger
         WHERE phone = $3 AND category = $4 AND verified = TRUE AND expires_at > NOW()) AS category_total,
        (SELECT COALESCE(total_earned, 0) FROM zora_points WHERE phone = $3)            AS total_earned,
        (SELECT cap_percent FROM zora_category_caps WHERE category = $4)                AS cap_percent`,
      [action_type, proof_reference, phone, rule.category]
    );
    const v = vRes.rows[0];

    // ÉTAPE 3 — IDEMPOTENCE
    if (parseInt(v.already_credited) > 0) {
      console.log(`[ZORA] Crédit déjà existant pour phone: ${phone}, action: ${action_type}, ref: ${proof_reference}`);
      await client.query('ROLLBACK');
      return { success: false, reason: 'already_credited' };
    }

    // ÉTAPE 4 — PLAFOND JOURNALIER
    if (rule.daily_cap && parseInt(v.today_count) >= rule.daily_cap) {
      console.log(`[ZORA] Plafond journalier atteint pour phone: ${phone}, action: ${action_type}`);
      await client.query('ROLLBACK');
      return { success: false, reason: 'daily_cap_reached' };
    }

    // ÉTAPE 5 — PLAFOND CATÉGORIE
    const categoryTotal    = parseInt(v.category_total) || 0;
    const totalEarned      = parseInt(v.total_earned)   || 0;
    const newTotalEarned   = totalEarned + rule.points;
    const newCategoryTotal = categoryTotal + rule.points;

    // Plafond catégorie : ne s'applique QUE si total_earned >= 500 points
    if (totalEarned >= 500 && v.cap_percent != null && parseFloat(v.cap_percent) > 0) {
      const capPercent = parseFloat(v.cap_percent);
      const maxCategoryPoints = Math.floor(newTotalEarned * capPercent / 100);
      if (newCategoryTotal > maxCategoryPoints) {
        console.log(`[ZORA] Plafond catégorie atteint pour phone: ${phone}, category: ${rule.category}`);
        await client.query('ROLLBACK');
        return { success: false, reason: 'category_cap_reached' };
      }
    }
    
    // ÉTAPE 6 — CRÉDIT + EXPIRATION GLISSANTE
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 12);
    
    // Insérer ligne ledger
    await client.query(
      `INSERT INTO zora_ledger 
       (phone, points, category, action_type, proof_class, proof_source, recording_method, proof_reference, verified, earned_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW(), $9)`,
      [phone, rule.points, rule.category, action_type, proof_class, proof_source, recording_method, proof_reference, expiresAt]
    );
    
    // UPDATE zora_points — balance TOUJOURS recalculé depuis ledger
    const pointsUpdate = await client.query(
      `INSERT INTO zora_points (phone, balance, total_earned, tier, last_activity_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'kimia', NOW(), NOW(), NOW())
       ON CONFLICT (phone) DO UPDATE SET
         balance = (
           SELECT COALESCE(SUM(points), 0) 
           FROM zora_ledger 
           WHERE phone = $1
         ),
         total_earned = zora_points.total_earned + $3,
         last_activity_at = NOW(),
         updated_at = NOW()
       RETURNING *`,
      [phone, rule.points, rule.points]
    );
    
    const updatedPoints = pointsUpdate.rows[0];
    
    // ÉTAPE 7 — RECALCUL DU TIER (tiers lus depuis cache mémoire, pas de round-trip Neon)
    const tiers = await getTiersConfig();
    let newTier = 'kimia';
    for (const tier of tiers) {
      if (updatedPoints.total_earned >= tier.min_points) {
        newTier = tier.tier_name;
      }
    }
    
    if (updatedPoints.tier !== newTier) {
      await client.query(
        'UPDATE zora_points SET tier = $1 WHERE phone = $2',
        [newTier, phone]
      );
      updatedPoints.tier = newTier;
    }
    
    // ÉTAPE 8 — AUDIT
    await client.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('zora_award', $1, 'zora_ledger', NULL, $2::jsonb)`,
      [phone, JSON.stringify({
        action_type,
        proof_class,
        proof_reference,
        points: rule.points,
        tier: newTier,
        expires_at: expiresAt
      })]
    );
    
    await client.query('COMMIT');

    // Émettre leaderboard_updated immédiatement après COMMIT, avant toute opération annexe
    try {
      const { getIo } = require('./socketService');
      const io = getIo();
      if (io) {
        io.emit('leaderboard_updated', { phone, newBalance: updatedPoints.balance });
        console.log('[Socket.io] leaderboard_updated émis pour', phone);
      } else {
        console.error('[Socket.io] getIo() a renvoyé NULL au moment de l\'émission');
      }
    } catch (e) {
      console.error('[Socket.io] erreur émission:', e.message);
    }

    // Mettre à jour le streak (non bloquant, hors transaction)
    setImmediate(async () => {
      try {
        await updateStreak({ phone });
      } catch (streakErr) {
        console.error('[ZORA] Erreur updateStreak (non bloquante):', streakErr.message);
      }
    });
    
    // Auto-post achievement dans le chat communauté pour certaines actions
    const achievementActions = ['bilan_annuel', 'vaccination', 'event_checkin', 'streak_7', 'streak_30'];
    if (achievementActions.includes(action_type)) {
      try {
        await chatService.postAchievement({ phone, action_type, points: rule.points });
      } catch (chatError) {
        console.error('[ZORA] Erreur auto-post achievement:', chatError.message);
        // Ne pas bloquer le crédit si le chat échoue
      }
    }
    
    console.log(`[ZORA] Crédit réussi pour phone: ${phone}, action: ${action_type}, points: ${rule.points}, tier: ${newTier}`);

    // Post système automatique dans le feed réseau social (non bloquant)
    try {
      const feedService = require('./feed.service');
      await feedService.postZoraEarned(phone, rule.points, action_type);
    } catch (feedError) {
      console.error('[ZORA] Erreur post feed (non bloquante):', feedError.message);
    }

    return {
      success: true,
      points: rule.points,
      balance: updatedPoints.balance,
      total_earned: updatedPoints.total_earned,
      tier: newTier,
      expires_at: expiresAt
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[ZORA] Erreur:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Récupérer le solde Zora d'un utilisateur
 */
async function getZoraBalance(phone) {
  const result = await pool.query(
    'SELECT * FROM zora_points WHERE phone = $1',
    [phone]
  );
  
  if (result.rows.length === 0) {
    // Créer un compte par défaut
    await pool.query(
      `INSERT INTO zora_points (phone, balance, total_earned, tier, last_activity_at, created_at, updated_at)
       VALUES ($1, 0, 0, 'kimia', NOW(), NOW(), NOW())`,
      [phone]
    );
    return {
      balance: 0,
      total_earned: 0,
      tier: 'kimia',
      last_activity_at: new Date(),
      next_tier: 'liboso',
      points_to_next: 500
    };
  }
  
  const points = result.rows[0];
  
  // Calculer le prochain palier
  const tiersResult = await pool.query(
    'SELECT * FROM zora_tiers_config WHERE is_active = TRUE ORDER BY min_points'
  );
  
  let nextTier = null;
  let pointsToNext = 0;
  
  for (const tier of tiersResult.rows) {
    if (tier.min_points > points.total_earned) {
      nextTier = tier.tier_name;
      pointsToNext = tier.min_points - points.total_earned;
      break;
    }
  }
  
  // Vérifier expiration warning (points expirant dans moins de 30 jours)
  const expiringResult = await pool.query(
    `SELECT SUM(points) as expiring_points, MIN(expires_at) as nearest_expiration
     FROM zora_ledger 
     WHERE phone = $1 AND verified = TRUE 
     AND expires_at BETWEEN NOW() AND NOW() + INTERVAL '30 days'`,
    [phone]
  );
  
  const expiringData = expiringResult.rows[0];
  let expiresAtWarning = null;
  
  if (expiringData.expiring_points && parseInt(expiringData.expiring_points) > 0) {
    expiresAtWarning = {
      points: parseInt(expiringData.expiring_points),
      expires_at: expiringData.nearest_expiration
    };
  }
  
  return {
    balance: points.balance,
    total_earned: points.total_earned,
    tier: points.tier,
    last_activity_at: points.last_activity_at,
    next_tier: nextTier,
    points_to_next: pointsToNext,
    expires_at_warning: expiresAtWarning
  };
}

/**
 * Récupérer le ledger Zora d'un utilisateur
 */
async function getZoraLedger(phone, page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  
  const result = await pool.query(
    `SELECT 
       zl.*,
       zer.label_fr
     FROM zora_ledger zl
     LEFT JOIN zora_earn_rules zer ON zl.action_type = zer.action_type
     WHERE zl.phone = $1
     ORDER BY zl.earned_at DESC
     LIMIT $2 OFFSET $3`,
    [phone, limit, offset]
  );
  
  const countResult = await pool.query(
    'SELECT COUNT(*) as total FROM zora_ledger WHERE phone = $1',
    [phone]
  );
  
  return {
    data: result.rows,
    pagination: {
      page,
      limit,
      total: parseInt(countResult.rows[0].total),
      pages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
    }
  };
}

/**
 * Récupérer la configuration des paliers
 */
async function getZoraTiers() {
  const result = await pool.query(
    'SELECT * FROM zora_tiers_config WHERE is_active = TRUE ORDER BY min_points'
  );
  return result.rows;
}

/**
 * Récupérer les règles de gain actives
 */
async function getZoraEarnRules() {
  const result = await pool.query(
    "SELECT * FROM zora_earn_rules WHERE is_active = TRUE ORDER BY category, action_type"
  );
  return result.rows;
}

/**
 * Resynchroniser le balance Zora depuis le ledger pour un phone donné
 * Utilisé pour corriger les incohérences de balance
 */
async function recalculateBalance(phone) {
  try {
    const ledgerSumResult = await pool.query(
      `SELECT COALESCE(SUM(points), 0) as ledger_sum 
       FROM zora_ledger 
       WHERE phone = $1`,
      [phone]
    );
    
    const ledgerSum = parseInt(ledgerSumResult.rows[0].ledger_sum);
    
    const updateResult = await pool.query(
      `UPDATE zora_points 
       SET balance = $1, updated_at = NOW()
       WHERE phone = $2
       RETURNING *`,
      [ledgerSum, phone]
    );
    
    if (updateResult.rows.length === 0) {
      // Créer le compte s'il n'existe pas
      await pool.query(
        `INSERT INTO zora_points (phone, balance, total_earned, tier, last_activity_at, created_at, updated_at)
         VALUES ($1, $2, $2, 'kimia', NOW(), NOW(), NOW())`,
        [phone, ledgerSum]
      );
    }
    
    console.log(`[ZORA] Balance resynchronisé pour ${phone}: ${ledgerSum} points`);
    return { success: true, balance: ledgerSum };
  } catch (error) {
    console.error('[ZORA] Erreur recalculateBalance:', error.message);
    throw error;
  }
}

module.exports = {
  awardZora,
  getZoraBalance,
  getZoraLedger,
  getZoraTiers,
  getZoraEarnRules,
  recalculateBalance
};
