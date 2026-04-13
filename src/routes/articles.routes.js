const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const {
  uploadMiddleware,
  uploadImage,
  getArticles,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
  getAllArticlesAdmin
} = require('../controllers/articles.controller');

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
  }
  next();
}

// ── UPLOAD IMAGE ─────────────────────────────────────────────
// POST /api/v1/articles/upload-image  (multipart/form-data, champ "image")
router.post('/upload-image', authMiddleware, adminOnly, uploadMiddleware, uploadImage);

// ── ROUTES PUBLIQUES ─────────────────────────────────────────
router.get('/', getArticles);
router.get('/admin/all', authMiddleware, adminOnly, getAllArticlesAdmin);
router.get('/:id', getArticleById);

// ── ROUTES ADMIN ─────────────────────────────────────────────
router.post('/',      authMiddleware, adminOnly, createArticle);
router.put('/:id',    authMiddleware, adminOnly, updateArticle);
router.delete('/:id', authMiddleware, adminOnly, deleteArticle);

module.exports = router;