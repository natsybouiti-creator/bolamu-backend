// ============================================================
// Routes : Groupes de sport
// DÉPRÉCIÉ (Task B4) — remplacé par clubs.routes.js.
// Tables sport_groups / sport_group_members supprimées (migration_064).
// Fichier non monté dans server.js — conservé pour référence historique.
// ============================================================

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');

const goneHandler = (req, res) => {
  res.status(410).json({
    success: false,
    message: 'Route dépréciée — utiliser /clubs/*'
  });
};

/**
 * GET /api/v1/sport-groups
 * Liste des groupes de sport (auth optionnel)
 */
router.get('/', goneHandler);

/**
 * POST /api/v1/sport-groups/:id/join
 * Rejoindre un groupe (auth patient requis)
 */
router.post('/:id/join', authMiddleware, goneHandler);

/**
 * DELETE /api/v1/sport-groups/:id/join
 * Quitter un groupe (auth patient requis)
 */
router.delete('/:id/join', authMiddleware, goneHandler);

/**
 * GET /api/v1/sport-groups/:id/members
 * Top membres d'un groupe
 */
router.get('/:id/members', goneHandler);

module.exports = router;
