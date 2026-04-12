const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const {
    getArticles,
    getArticleById,
    createArticle,
    updateArticle,
    deleteArticle,
    getAllArticlesAdmin
} = require('../controllers/articles.controller');

// ── ROUTES PUBLIQUES ──────────────────────────────────────────
router.get('/', getArticles);               // GET /api/v1/articles?category=paludisme
router.get('/:id', getArticleById);         // GET /api/v1/articles/1

// ── ROUTES ADMIN (token requis) ───────────────────────────────
router.get('/admin/all', authMiddleware, getAllArticlesAdmin);       // liste admin
router.post('/', authMiddleware, createArticle);                     // créer
router.put('/:id', authMiddleware, updateArticle);                   // modifier
router.delete('/:id', authMiddleware, deleteArticle);                // supprimer

module.exports = router;