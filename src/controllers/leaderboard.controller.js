// ============================================================
// BOLAMU — Sprint 6A : Controller Leaderboard
// ============================================================
const { getLeaderboard, getTop3 } = require('../services/leaderboard.service');

/**
 * GET /api/v1/leaderboard/weekly
 * Top 10 + position du demandeur (auth requise)
 */
async function getWeeklyLeaderboard(req, res) {
  const phone = req.user?.phone;
  const limit = parseInt(req.query.limit) || 10;
  
  try {
    const result = await getLeaderboard({ phone, limit });
    return res.json(result);
  } catch (error) {
    console.error('[LEADERBOARD] Erreur getWeeklyLeaderboard:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

/**
 * GET /api/v1/leaderboard/weekly/top3
 * Top 3 sans auth (pour landing page)
 */
async function getWeeklyTop3(req, res) {
  try {
    const result = await getTop3();
    return res.json(result);
  } catch (error) {
    console.error('[LEADERBOARD] Erreur getWeeklyTop3:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

module.exports = {
  getWeeklyLeaderboard,
  getWeeklyTop3
};
