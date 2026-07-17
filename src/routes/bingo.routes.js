// ============================================================
// BOLAMU — Routes Bingo Santé (5e jeu Zora)
// ============================================================
const express = require('express');
const router = express.Router();
const { getOrCreateWeeklyGrid, checkCell, rerollGrid } = require('../services/bingo.service');
const authMiddleware = require('../middleware/auth.middleware');

// GET /api/v1/zora/games/bingo — grille de la semaine du patient (créée si inexistante)
router.get('/games/bingo', authMiddleware, async (req, res) => {
  try {
    const phone = req.user.phone;
    const result = await getOrCreateWeeklyGrid({ phone });

    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[BINGO] Erreur GET /games/bingo:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// POST /api/v1/zora/games/bingo/check — coche une case
router.post('/games/bingo/check', authMiddleware, async (req, res) => {
  try {
    const { index } = req.body;
    const phone = req.user.phone;

    if (index === undefined || index === null) {
      return res.status(400).json({ success: false, error: 'missing_parameters' });
    }

    const result = await checkCell({ phone, index: parseInt(index, 10) });

    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      const statusMap = {
        'invalid_index': 400,
        'grid_not_found': 404,
        'already_checked': 400
      };
      const statusCode = statusMap[result.error] || 500;
      res.status(statusCode).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[BINGO] Erreur POST /games/bingo/check:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// POST /api/v1/zora/games/bingo/reroll — régénère la grille de la semaine (payant)
router.post('/games/bingo/reroll', authMiddleware, async (req, res) => {
  try {
    const phone = req.user.phone;
    const result = await rerollGrid({ phone });

    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      const statusMap = {
        'grid_not_found': 404,
        'insufficient_balance': 400,
        'game_not_found': 404
      };
      const statusCode = statusMap[result.error] || 500;
      res.status(statusCode).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[BINGO] Erreur POST /games/bingo/reroll:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

module.exports = router;
