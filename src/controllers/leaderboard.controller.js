// ============================================================
// BOLAMU — Sprint 6A : Controller Leaderboard
// ============================================================
const { getLeaderboard, getTop3 } = require('../services/leaderboard.service');

/**
 * GET /api/v1/leaderboard/weekly
 * Top 10 + position du demandeur (auth requise)
 * getLeaderboard() (leaderboard.service.js) calcule en live sur zora_ledger.
 * Format de réponse unifié avec la modale (/api/v1/patients/leaderboard/weekly)
 * depuis le Fix 6 (13 juillet 2026) : { success, data: { top, my_position } }.
 */
async function getWeeklyLeaderboard(req, res) {
  const phone = req.user?.phone;
  const limit = parseInt(req.query.limit) || 10;

  try {
    const result = await getLeaderboard({ phone, limit });
    return res.json({ success: result.success, data: { top: result.top, my_position: result.my_position } });
  } catch (error) {
    console.error('[LEADERBOARD] Erreur getWeeklyLeaderboard:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

/**
 * GET /api/v1/leaderboard/weekly/top3
 * Top 3 sans auth (pour landing page) — route orpheline, aucun frontend ne
 * l'appelle (vérifié 13 juillet 2026). Enveloppe alignée sur les autres
 * routes classement ; champs inchangés (pas de full_name/phone/photo_url,
 * route publique sans auth).
 */
async function getWeeklyTop3(req, res) {
  try {
    const result = await getTop3();
    return res.json({ success: result.success, data: { top: result.data } });
  } catch (error) {
    console.error('[LEADERBOARD] Erreur getWeeklyTop3:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

module.exports = {
  getWeeklyLeaderboard,
  getWeeklyTop3
};
