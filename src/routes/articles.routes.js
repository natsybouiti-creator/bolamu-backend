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

const pool = require('../config/db');

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
  }
  next();
}

// ── UPLOAD IMAGE ─────────────────────────────────────────────
router.post('/upload-image', authMiddleware, adminOnly, uploadMiddleware, uploadImage);

// ── CONTENT BLOCKS (Vitrine & Hero) ─────────────────────────
// GET public — index.html charge les blocs vitrine
router.get('/content-blocks', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT key, value FROM platform_config WHERE key LIKE 'vitrine_%'`
    );
    const blocks = {};
    result.rows.forEach(row => {
      const blockKey = row.key.replace('vitrine_', '');
      try { blocks[blockKey] = JSON.parse(row.value); }
      catch(e) { blocks[blockKey] = row.value; }
    });
    return res.json({ success: true, blocks });
  } catch (err) {
    console.error('[content-blocks GET]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT admin — sauvegarder un bloc vitrine
router.put('/content-blocks/:key', authMiddleware, adminOnly, async (req, res) => {
  const { key } = req.params;
  const value = JSON.stringify(req.body);
  try {
    await pool.query(
      `INSERT INTO platform_config (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [`vitrine_${key}`, value]
    );
    return res.json({ success: true, message: 'Bloc sauvegardé' });
  } catch (err) {
    console.error('[content-blocks PUT]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ── ROUTES PUBLIQUES ─────────────────────────────────────────
router.get('/', getArticles);
router.get('/admin/all', authMiddleware, adminOnly, getAllArticlesAdmin);
router.get('/:id', getArticleById);

// ── ROUTES ADMIN ─────────────────────────────────────────────
router.post('/',      authMiddleware, adminOnly, createArticle);
router.put('/:id',    authMiddleware, adminOnly, updateArticle);
router.delete('/:id', authMiddleware, adminOnly, deleteArticle);

module.exports = router;