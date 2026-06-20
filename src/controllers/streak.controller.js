// ============================================================
// BOLAMU — Sprint 6A : Controller Streaks
// ============================================================
const { getStreak } = require('../services/streak.service');

/**
 * GET /api/v1/streaks/me
 * Récupérer le streak de l'utilisateur authentifié
 */
async function getMyStreak(req, res) {
  const phone = req.user?.phone;
  
  if (!phone) {
    return res.status(401).json({ success: false, message: 'Non authentifié' });
  }
  
  try {
    const result = await getStreak({ phone });
    return res.json(result);
  } catch (error) {
    console.error('[STREAK] Erreur getMyStreak:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

module.exports = {
  getMyStreak
};
