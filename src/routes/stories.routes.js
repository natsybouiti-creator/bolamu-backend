// ============================================================
// BOLAMU — Routes Stories (réseau social, contenu éphémère 24h)
// ============================================================
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');
const storiesCtrl = require('../controllers/stories.controller');

// Stories actives des follows (non expirées)
router.get('/',                     authMiddleware, storiesCtrl.getActiveStories);

// Créer une story (photo ou vidéo courte — max 60s)
router.post('/',                    authMiddleware, upload.single('media'), storiesCtrl.createStory);

// Marquer une story comme vue
router.post('/:storyId/view',       authMiddleware, storiesCtrl.markViewed);

// Voir qui a vu ma story
router.get('/:storyId/viewers',     authMiddleware, storiesCtrl.getViewers);

// Supprimer sa story
router.delete('/:storyId',          authMiddleware, storiesCtrl.deleteStory);

module.exports = router;
