// ============================================================
// BOLAMU — Sprint 4 : Routes Jeux Zora
// ============================================================
const express = require('express');
const router = express.Router();
const {
  playGame,
  submitQuizAnswer,
  getGamesConfig,
  getGamesStatus,
  getGamesHistory
} = require('../services/zora-games.service');
const authMiddleware = require('../middleware/auth.middleware');

// ============================================================
// ENDPOINTS PUBLIC
// ============================================================

// GET /api/v1/zora/games/config - Configuration des jeux (PUBLIC)
router.get('/games/config', async (req, res) => {
  try {
    const result = await getGamesConfig();
    
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[ZORA GAMES] Erreur GET /games/config:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// ============================================================
// ENDPOINTS PROTÉGÉS (auth JWT patient)
// ============================================================

// GET /api/v1/zora/games/status - Statut des jeux pour l'utilisateur
router.get('/games/status', authMiddleware, async (req, res) => {
  try {
    const phone = req.user.phone;
    const result = await getGamesStatus({ phone });
    
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[ZORA GAMES] Erreur GET /games/status:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// POST /api/v1/zora/games/play - Jouer une partie
router.post('/games/play', authMiddleware, async (req, res) => {
  try {
    const { game_type, play_type } = req.body;
    const phone = req.user.phone;
    
    if (!game_type || !play_type) {
      return res.status(400).json({ success: false, error: 'missing_parameters' });
    }
    
    if (!['scratch', 'wheel', 'chest', 'quiz'].includes(game_type)) {
      return res.status(400).json({ success: false, error: 'invalid_game_type' });
    }
    
    if (!['free', 'paid'].includes(play_type)) {
      return res.status(400).json({ success: false, error: 'invalid_play_type' });
    }
    
    const result = await playGame({ phone, game_type, play_type });
    
    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      const statusMap = {
        'game_not_found': 404,
        'free_play_already_used': 400,
        'insufficient_balance': 400,
        'no_questions_available': 400,
        'no_prizes_available': 500
      };
      const statusCode = statusMap[result.error] || 500;
      res.status(statusCode).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[ZORA GAMES] Erreur POST /games/play:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// POST /api/v1/zora/games/quiz/answer - Soumettre réponse quiz
router.post('/games/quiz/answer', authMiddleware, async (req, res) => {
  try {
    const { play_id, answer } = req.body;
    const phone = req.user.phone;
    
    if (!play_id || !answer) {
      return res.status(400).json({ success: false, error: 'missing_parameters' });
    }
    
    const result = await submitQuizAnswer({ phone, play_id, answer });
    
    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      const statusMap = {
        'play_not_found': 404,
        'answer_timeout': 400
      };
      const statusCode = statusMap[result.error] || 500;
      res.status(statusCode).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[ZORA GAMES] Erreur POST /games/quiz/answer:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// GET /api/v1/zora/games/history - Historique des parties
router.get('/games/history', authMiddleware, async (req, res) => {
  try {
    const phone = req.user.phone;
    const limit = parseInt(req.query.limit) || 30;
    
    const result = await getGamesHistory({ phone, limit });
    
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[ZORA GAMES] Erreur GET /games/history:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

module.exports = router;
