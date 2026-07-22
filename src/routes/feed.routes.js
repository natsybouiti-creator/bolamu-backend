// ============================================================
// BOLAMU — Routes Feed (réseau social)
// ============================================================
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const optionalAuth = require('../middleware/optionalAuth.middleware');
const upload = require('../middleware/upload.middleware');
const feedCtrl = require('../controllers/feed.controller');

// Feed principal — posts des follows + système
router.get('/',                         optionalAuth, feedCtrl.getFeed);

// Créer un post manuel (texte ou texte + photo)
router.post('/',                        authMiddleware, upload.single('photo'), feedCtrl.createPost);

// Like / unlike
router.post('/:postId/like',            authMiddleware, feedCtrl.toggleLike);

// Commentaires
router.get('/:postId/comments',         authMiddleware, feedCtrl.getComments);
router.post('/:postId/comments',        authMiddleware, feedCtrl.addComment);
router.delete('/:postId/comments/:id',  authMiddleware, feedCtrl.deleteComment);

// Signalement (alimente la file de modération — ne masque rien automatiquement)
router.post('/comments/:commentId/report', authMiddleware, feedCtrl.reportComment);
router.post('/:postId/report',          authMiddleware, feedCtrl.reportPost);

// Supprimer son propre post
router.delete('/:postId',               authMiddleware, feedCtrl.deletePost);

// Profil social d'un patient
router.get('/profile/:phone',           authMiddleware, feedCtrl.getProfile);

// Recherche d'utilisateurs (nom ou téléphone) avec statut de suivi
router.get('/search-users',             authMiddleware, feedCtrl.searchUsers);

// Suggestions de membres à suivre (par ville)
router.get('/suggestions',              authMiddleware, feedCtrl.getSuggestions);

module.exports = router;
