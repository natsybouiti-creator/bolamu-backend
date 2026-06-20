// ============================================================
// BOLAMU — Sprint 6A : Routes Streaks
// ============================================================
const express = require('express');
const router = express.Router();
const { getMyStreak } = require('../controllers/streak.controller');
const authMiddleware = require('../middleware/auth.middleware');

// GET /api/v1/streaks/me - Mon streak (auth requise)
router.get('/me', authMiddleware, getMyStreak);

module.exports = router;
