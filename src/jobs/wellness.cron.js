// ============================================================
// BOLAMU — Sprint 2 : Wellness Cron Job
// ============================================================
const cron = require('node-cron');
const pool = require('../config/db');
const { syncPatientData } = require('../services/googlefit.service');
const { evaluateRules } = require('../services/wellness.service');
const logger = require('../config/logger');

/**
 * Sync Google Fit pour tous les patients connectés
 * Toutes les 6 heures (0h, 6h, 12h, 18h)
 */
const syncGoogleFitCron = cron.schedule('0 */6 * * *', async () => {
  logger.info('[WELLNESS CRON] Début sync Google Fit pour tous les patients connectés');

  try {
    const result = await pool.query(
      `SELECT patient_phone FROM google_fit_tokens WHERE token_expiry > NOW()`
    );

    const patients = result.rows;
    let successCount = 0;
    let errorCount = 0;

    for (const patient of patients) {
      try {
        await syncPatientData(patient.patient_phone);
        successCount++;
      } catch (error) {
        errorCount++;
        logger.error(`[WELLNESS CRON] Erreur sync ${patient.patient_phone}:`, error.message);
      }
    }

    logger.info(`[WELLNESS CRON] Sync Google Fit terminé : ${successCount} succès, ${errorCount} erreurs`);
  } catch (error) {
    logger.error('[WELLNESS CRON] Erreur sync Google Fit global:', error.message);
  }
}, {
  timezone: 'Africa/Brazzaville'
});

/**
 * Évaluer les règles wellness pour tous les patients
 * Toutes les 6 heures (0h, 6h, 12h, 18h) — 30 min après le sync
 */
const evaluateWellnessRulesCron = cron.schedule('30 */6 * * *', async () => {
  logger.info('[WELLNESS CRON] Début évaluation règles wellness pour tous les patients');

  try {
    const result = await pool.query(
      `SELECT phone FROM users WHERE role = 'patient' AND is_active = TRUE`
    );

    const patients = result.rows;
    let successCount = 0;
    let errorCount = 0;

    for (const patient of patients) {
      try {
        await evaluateRules(patient.phone);
        successCount++;
      } catch (error) {
        errorCount++;
        logger.error(`[WELLNESS CRON] Erreur évaluation ${patient.phone}:`, error.message);
      }
    }

    logger.info(`[WELLNESS CRON] Évaluation terminée : ${successCount} succès, ${errorCount} erreurs`);
  } catch (error) {
    logger.error('[WELLNESS CRON] Erreur évaluation globale:', error.message);
  }
}, {
  timezone: 'Africa/Brazzaville'
});

/**
 * Démarrer les cron jobs wellness
 */
function startWellnessCron() {
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_WELLNESS_CRON === 'true') {
    syncGoogleFitCron.start();
    evaluateWellnessRulesCron.start();
    logger.info('[WELLNESS CRON] Cron jobs wellness démarrés');
  } else {
    logger.info('[WELLNESS CRON] Cron jobs wellness désactivés (NODE_ENV != production et ENABLE_WELLNESS_CRON != true)');
  }
}

module.exports = {
  startWellnessCron
};
