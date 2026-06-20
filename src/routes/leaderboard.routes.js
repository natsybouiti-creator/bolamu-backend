// ============================================================
// BOLAMU — Sprint 6A : Routes Leaderboard
// ============================================================
const express = require('express');
const router = express.Router();
const { getWeeklyLeaderboard, getWeeklyTop3 } = require('../controllers/leaderboard.controller');
const { authMiddleware } = require('../middleware/auth');

// GET /api/v1/leaderboard/weekly - Top 10 + ma position (auth requise)
router.get('/weekly', authMiddleware, getWeeklyLeaderboard);

// GET /api/v1/leaderboard/weekly/top3 - Top 3 sans auth (landing page)
router.get('/weekly/top3', getWeeklyTop3);

module.exports = router;
