// ============================================================
// BOLAMU — Sprint 2 : Wellness Routes
// ============================================================
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const {
  getGoogleFitAuthUrl,
  googleFitCallback,
  syncGoogleFit,
  evaluateWellnessRules,
  creditWellnessActionController,
  getDailyStatsController,
  getWeeklyStatsController,
  getLeaderboardController
} = require('../controllers/wellness.controller');

// Google Fit OAuth (public pour l'URL d'auth, callback public)
router.get('/google-fit/auth-url', getGoogleFitAuthUrl);
router.post('/google-fit/callback', googleFitCallback);

// Google Fit sync (patient connecté)
router.post('/google-fit/sync', authMiddleware, syncGoogleFit);

// Évaluation des règles wellness (patient connecté)
router.post('/evaluate', authMiddleware, evaluateWellnessRules);

// Crédit action wellness (admin/secrétaire seulement)
router.post('/credit', authMiddleware, creditWellnessActionController);

// Stats patient (patient connecté)
router.get('/stats/daily', authMiddleware, getDailyStatsController);
router.get('/stats/weekly', authMiddleware, getWeeklyStatsController);

// Leaderboard (public)
router.get('/leaderboard', getLeaderboardController);

module.exports = router;
