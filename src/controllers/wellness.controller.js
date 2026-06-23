// ============================================================
// BOLAMU — Sprint 2 : Wellness Controller
// ============================================================
const { getAuthUrl, exchangeCode, syncPatientData } = require('../services/googlefit.service');
const { evaluateRules, creditWellnessAction, getDailyStats, getWeeklyStats, getLeaderboard } = require('../services/wellness.service');
const logger = require('../config/logger');

/**
 * GET /api/v1/wellness/google-fit/auth-url
 * Générer l'URL d'authentification Google Fit
 */
async function getGoogleFitAuthUrl(req, res) {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Paramètre phone requis' });
    }

    const authUrl = getAuthUrl(phone);

    res.json({ success: true, auth_url: authUrl });
  } catch (error) {
    logger.error('[WELLNESS] Erreur getGoogleFitAuthUrl:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

/**
 * POST /api/v1/wellness/google-fit/callback
 * Callback OAuth Google Fit
 */
async function googleFitCallback(req, res) {
  try {
    const { code, state } = req.body;

    if (!code || !state) {
      return res.status(400).json({ success: false, message: 'Paramètres code et state requis' });
    }

    const result = await exchangeCode(code, state);

    res.json(result);
  } catch (error) {
    logger.error('[WELLNESS] Erreur googleFitCallback:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

/**
 * POST /api/v1/wellness/google-fit/sync
 * Synchroniser les données Google Fit d'un patient
 */
async function syncGoogleFit(req, res) {
  try {
    const { phone } = req.user;

    const result = await syncPatientData(phone);

    res.json(result);
  } catch (error) {
    logger.error('[WELLNESS] Erreur syncGoogleFit:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

/**
 * POST /api/v1/wellness/evaluate
 * Évaluer les règles wellness pour un patient
 */
async function evaluateWellnessRules(req, res) {
  try {
    const { phone } = req.user;
    const { date } = req.body;

    const result = await evaluateRules(phone, date);

    res.json(result);
  } catch (error) {
    logger.error('[WELLNESS] Erreur evaluateWellnessRules:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

/**
 * POST /api/v1/wellness/credit
 * Créditer une action wellness (admin/secrétaire seulement)
 */
async function creditWellnessActionController(req, res) {
  try {
    const { patient_phone, action_type, reference_id } = req.body;
    const { phone: validatedBy } = req.user;

    if (!patient_phone || !action_type || !reference_id) {
      return res.status(400).json({ success: false, message: 'Paramètres patient_phone, action_type et reference_id requis' });
    }

    const result = await creditWellnessAction(patient_phone, action_type, reference_id, validatedBy);

    res.json(result);
  } catch (error) {
    logger.error('[WELLNESS] Erreur creditWellnessActionController:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

/**
 * GET /api/v1/wellness/stats/daily
 * Stats journalières du patient connecté
 */
async function getDailyStatsController(req, res) {
  try {
    const { phone } = req.user;
    const { date } = req.query;

    const stats = await getDailyStats(phone, date);

    res.json({ success: true, stats });
  } catch (error) {
    logger.error('[WELLNESS] Erreur getDailyStatsController:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

/**
 * GET /api/v1/wellness/stats/weekly
 * Stats hebdomadaires du patient connecté
 */
async function getWeeklyStatsController(req, res) {
  try {
    const { phone } = req.user;

    const stats = await getWeeklyStats(phone);

    res.json({ success: true, stats });
  } catch (error) {
    logger.error('[WELLNESS] Erreur getWeeklyStatsController:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

/**
 * GET /api/v1/wellness/leaderboard
 * Leaderboard (top 10 cette semaine, initiales uniquement)
 */
async function getLeaderboardController(req, res) {
  try {
    const leaderboard = await getLeaderboard();

    res.json({ success: true, leaderboard });
  } catch (error) {
    logger.error('[WELLNESS] Erreur getLeaderboardController:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

module.exports = {
  getGoogleFitAuthUrl,
  googleFitCallback,
  syncGoogleFit,
  evaluateWellnessRules,
  creditWellnessActionController,
  getDailyStatsController,
  getWeeklyStatsController,
  getLeaderboardController
};
