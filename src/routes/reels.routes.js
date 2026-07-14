// ============================================================
// BOLAMU — Routes Reels (réseau social, vidéo courte permanente)
// ============================================================
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const optionalAuth = require('../middleware/optionalAuth.middleware');
const upload = require('../middleware/upload.middleware');
const reelsCtrl = require('../controllers/reels.controller');

// Liste paginée des reels des follows (même filtre de confidentialité que le feed)
router.get('/',              optionalAuth, reelsCtrl.getReels);

// Publier un reel (vidéo courte, max 60s — pas d'expiration contrairement aux stories)
router.post('/',             authMiddleware, upload.single('media'), reelsCtrl.createReel);

// Supprimer son propre reel
router.delete('/:reelId',    authMiddleware, reelsCtrl.deleteReel);

// Like/commentaires : réutilise tel quel /api/v1/feed/:postId/like et /comments
// (feed.controller.js n'est pas restreint par type de post).

module.exports = router;
