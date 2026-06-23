// ============================================================
// BOLAMU — Sprint 2 : Clubs Routes
// ============================================================
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const {
  getClubs,
  getClubById,
  joinClub,
  leaveClub,
  getMyClubs
} = require('../controllers/clubs.controller');

// Public
router.get('/', getClubs);
router.get('/:id', getClubById);

// Patient connecté
router.post('/:id/join', authMiddleware, joinClub);
router.delete('/:id/join', authMiddleware, leaveClub);
router.get('/my', authMiddleware, getMyClubs);

module.exports = router;
