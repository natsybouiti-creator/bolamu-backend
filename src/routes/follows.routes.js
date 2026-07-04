// ============================================================
// BOLAMU — Routes Follows (réseau social, abonnements)
// ============================================================
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const followsCtrl = require('../controllers/follows.controller');

// Liste de mes abonnements
router.get('/following',        authMiddleware, followsCtrl.getFollowing);

// Liste de mes abonnés
router.get('/followers',        authMiddleware, followsCtrl.getFollowers);

// Statut follow entre deux utilisateurs
router.get('/status/:phone',    authMiddleware, followsCtrl.getStatus);

// Suivre un utilisateur
router.post('/:phone',          authMiddleware, followsCtrl.follow);

// Ne plus suivre
router.delete('/:phone',        authMiddleware, followsCtrl.unfollow);

module.exports = router;
