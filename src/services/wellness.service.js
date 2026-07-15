// ============================================================
// BOLAMU — Sprint 2 : Wellness Service
// ============================================================
const pool = require('../config/db');
const { normalizePhone } = require('../utils/phone');
const { awardZora } = require('./zora.service');
const logger = require('../config/logger');

/**
 * Mapping wellness_rules → zora_earn_rules action_type
 */
const WELLNESS_RULE_TO_ZORA_ACTION = {
  'steps_8000': 'steps_8000',
  'steps_5000': 'steps_5000',
  'sleep_7h': 'sleep_7h',
  'activity_30': 'activity_30',
  'heart_rate': 'heart_rate',
  'consultation': 'consultation',
  'rdv_honore': 'rdv_honore',
  'evenement': 'evenement',
  'atelier': 'atelier',
  'dossier_update': 'dossier_update',
  'profil_complete': 'profil_complete'
};

/**
 * Évaluer les règles wellness pour un patient à une date donnée
 * @param {string} patientPhone - Numéro du patient
 * @param {string} date - Date au format YYYY-MM-DD (défaut : aujourd'hui)
 * @returns {Promise<Object>} Résultat de l'évaluation
 */
async function evaluateRules(patientPhone, date = null) {
  const normalizedPhone = normalizePhone(patientPhone);
  const targetDate = date || new Date().toISOString().split('T')[0];

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Récupérer les logs wellness du jour
    const logsResult = await client.query(
      `SELECT metric, value, recorded_at
       FROM wellness_logs
       WHERE patient_phone = $1
         AND DATE(recorded_at) = $2
         AND source IN ('google_fit', 'bolamu')`,
      [normalizedPhone, targetDate]
    );

    const logs = logsResult.rows;

    // Agréger les totaux par métrique
    const aggregates = {};
    for (const log of logs) {
      if (!aggregates[log.metric]) {
        aggregates[log.metric] = 0;
      }
      aggregates[log.metric] += parseFloat(log.value);
    }

    // Récupérer les règles wellness actives
    const rulesResult = await client.query(
      `SELECT * FROM wellness_rules WHERE is_active = TRUE`
    );

    const rules = rulesResult.rows;
    let creditsAwarded = 0;

    for (const rule of rules) {
      if (!rule.metric || !rule.operator) {
        // Règles sans métrique (consultation, rdv_honore, etc.) → gérées via creditWellnessAction
        continue;
      }

      const metricValue = aggregates[rule.metric] || 0;
      let satisfied = false;

      if (rule.operator === 'gte' && metricValue >= rule.threshold) {
        satisfied = true;
      } else if (rule.operator === 'lte' && metricValue <= rule.threshold) {
        satisfied = true;
      } else if (rule.operator === 'eq' && metricValue === rule.threshold) {
        satisfied = true;
      }

      if (satisfied) {
        // Vérifier idempotence : pas de crédit déjà attribué aujourd'hui pour cette règle
        const proofReference = `wellness_${rule.metric}_${targetDate}`;

        const existingCredit = await client.query(
          `SELECT id FROM zora_ledger
           WHERE phone = $1 AND action_type = $2 AND proof_reference = $3 AND points > 0`,
          [normalizedPhone, WELLNESS_RULE_TO_ZORA_ACTION[rule.metric] || rule.metric, proofReference]
        );

        if (existingCredit.rows.length === 0) {
          // Vérifier max_per_day
          const todayCount = await client.query(
            `SELECT COUNT(*) as count FROM zora_ledger
             WHERE phone = $1 AND action_type = $2
               AND earned_at >= CURRENT_DATE`,
            [normalizedPhone, WELLNESS_RULE_TO_ZORA_ACTION[rule.metric] || rule.metric]
          );

          if (parseInt(todayCount.rows[0].count) < rule.max_per_day) {
            // Créditer via awardZora
            const actionType = WELLNESS_RULE_TO_ZORA_ACTION[rule.metric] || rule.metric;
            const result = await awardZora({
              phone: normalizedPhone,
              action_type: actionType,
              proof_class: 'device_measured',
              proof_source: 'google_fit',
              recording_method: 'auto_recorded',
              proof_reference: proofReference
            });

            if (result.success) {
              creditsAwarded++;
              logger.info(`[WELLNESS] Crédit ${actionType} pour ${normalizedPhone} : ${result.points} pts`);
            }
          }
        }
      }
    }

    await client.query('COMMIT');

    return { success: true, credits_awarded: creditsAwarded };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('[WELLNESS] Erreur evaluateRules:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Créditer une action wellness (consultation, rdv, événement, etc.)
 * @param {string} patientPhone - Numéro du patient
 * @param {string} actionType - Type d'action
 * @param {string} referenceId - Référence unique (appointment_id, event_id, etc.)
 * @param {string} validatedBy - Qui a validé (optionnel)
 * @returns {Promise<Object>} Résultat du crédit
 */
async function creditWellnessAction(patientPhone, actionType, referenceId, validatedBy = null) {
  const normalizedPhone = normalizePhone(patientPhone);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Vérifier si déjà crédité dans wellness_actions
    const existingAction = await client.query(
      `SELECT id FROM wellness_actions
       WHERE patient_phone = $1 AND action_type = $2 AND reference_id = $3`,
      [normalizedPhone, actionType, referenceId]
    );

    if (existingAction.rows.length > 0) {
      await client.query('ROLLBACK');
      return { success: false, reason: 'already_credited' };
    }

    // Déterminer proof_class selon actionType
    let proofClass = 'system_event';
    if (['evenement', 'atelier'].includes(actionType)) {
      proofClass = 'ground_truth';
    }

    // Créditer via awardZora
    const zoraResult = await awardZora({
      phone: normalizedPhone,
      action_type: actionType,
      proof_class: proofClass,
      proof_source: validatedBy || 'bolamu',
      recording_method: 'auto_recorded',
      proof_reference: referenceId
    });

    if (!zoraResult.success) {
      await client.query('ROLLBACK');
      return zoraResult;
    }

    // Insérer dans wellness_actions
    await client.query(
      `INSERT INTO wellness_actions (patient_phone, action_type, zora_points, validated_by, validated_at, reference_id)
       VALUES ($1, $2, $3, $4, NOW(), $5)`,
      [normalizedPhone, actionType, zoraResult.points, validatedBy, referenceId]
    );

    await client.query('COMMIT');

    logger.info(`[WELLNESS] Action ${actionType} créditée pour ${normalizedPhone} : ${zoraResult.points} pts`);

    return { success: true, points: zoraResult.points };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('[WELLNESS] Erreur creditWellnessAction:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Récupérer les stats journalières d'un patient
 * @param {string} patientPhone - Numéro du patient
 * @param {string} date - Date au format YYYY-MM-DD (défaut : aujourd'hui)
 * @returns {Promise<Object>} Stats journalières
 */
async function getDailyStats(patientPhone, date = null) {
  const normalizedPhone = normalizePhone(patientPhone);
  const targetDate = date || new Date().toISOString().split('T')[0];

  const result = await pool.query(
    `SELECT metric, SUM(value) as total_value, unit
     FROM wellness_logs
     WHERE patient_phone = $1 AND DATE(recorded_at) = $2
     GROUP BY metric, unit`,
    [normalizedPhone, targetDate]
  );

  const stats = {
    date: targetDate,
    steps: 0,
    distance: 0,
    calories: 0,
    sleep_duration: 0,
    heart_rate: 0,
    activity: 0
  };

  for (const row of result.rows) {
    if (stats.hasOwnProperty(row.metric)) {
      stats[row.metric] = parseFloat(row.total_value);
    }
  }

  return stats;
}

/**
 * Récupérer les stats hebdomadaires d'un patient (7 derniers jours)
 * @param {string} patientPhone - Numéro du patient
 * @returns {Promise<Array>} Stats par jour
 */
async function getWeeklyStats(patientPhone) {
  const normalizedPhone = normalizePhone(patientPhone);

  const result = await pool.query(
    `SELECT DATE(recorded_at) as date, metric, SUM(value) as total_value, unit
     FROM wellness_logs
     WHERE patient_phone = $1
       AND recorded_at >= NOW() - INTERVAL '7 days'
     GROUP BY DATE(recorded_at), metric, unit
     ORDER BY date DESC`,
    [normalizedPhone]
  );

  const days = {};
  for (const row of result.rows) {
    const dateStr = row.date.toISOString().split('T')[0];
    if (!days[dateStr]) {
      days[dateStr] = {
        date: dateStr,
        steps: 0,
        distance: 0,
        calories: 0,
        sleep_duration: 0,
        heart_rate: 0,
        activity: 0
      };
    }
    if (days[dateStr].hasOwnProperty(row.metric)) {
      days[dateStr][row.metric] = parseFloat(row.total_value);
    }
  }

  return Object.values(days);
}

/**
 * Récupérer le leaderboard (top 10 patients par points cette semaine)
 * Initiales uniquement (BHP)
 * @returns {Promise<Array>} Top 10
 */
async function getLeaderboard() {
  // Comptes de test QA exclus du classement all-time (même liste que le
  // classement hebdo, cf. leaderboard.service.js — audit Gagner/Santé du
  // 15 juillet 2026).
  const { TEST_PHONES_EXCLUDED_FROM_LEADERBOARD } = require('./leaderboard.service');
  const result = await pool.query(
    `SELECT
       u.full_name,
       u.member_code,
       zp.total_earned,
       zp.tier
     FROM zora_points zp
     JOIN users u ON zp.phone = u.phone
     WHERE u.role = 'patient'
       AND u.phone <> ALL($1)
       AND zp.last_activity_at >= NOW() - INTERVAL '7 days'
     ORDER BY zp.total_earned DESC
     LIMIT 10`,
    [TEST_PHONES_EXCLUDED_FROM_LEADERBOARD]
  );

  const leaderboard = result.rows.map(row => {
    const initials = row.full_name
      ? row.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
      : row.member_code ? row.member_code.slice(-2) : '??';

    return {
      initials: initials,
      points: row.total_earned,
      tier: row.tier
    };
  });

  return leaderboard;
}

module.exports = {
  evaluateRules,
  creditWellnessAction,
  getDailyStats,
  getWeeklyStats,
  getLeaderboard
};
