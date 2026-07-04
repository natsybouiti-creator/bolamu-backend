// ============================================================
// BOLAMU — Routes Feed (réseau social)
// ============================================================
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');
const feedCtrl = require('../controllers/feed.controller');

// Feed principal — posts des follows + système
router.get('/',                         authMiddleware, feedCtrl.getFeed);

// Créer un post manuel (texte ou texte + photo)
router.post('/',                        authMiddleware, upload.single('photo'), feedCtrl.createPost);

// Like / unlike
router.post('/:postId/like',            authMiddleware, feedCtrl.toggleLike);

// Commentaires
router.get('/:postId/comments',         authMiddleware, feedCtrl.getComments);
router.post('/:postId/comments',        authMiddleware, feedCtrl.addComment);
router.delete('/:postId/comments/:id',  authMiddleware, feedCtrl.deleteComment);

// Supprimer son propre post
router.delete('/:postId',               authMiddleware, feedCtrl.deletePost);

// Profil social d'un patient
router.get('/profile/:phone',           authMiddleware, feedCtrl.getProfile);

// Suggestions de membres à suivre (par ville)
router.get('/suggestions',              authMiddleware, feedCtrl.getSuggestions);

module.exports = router;
