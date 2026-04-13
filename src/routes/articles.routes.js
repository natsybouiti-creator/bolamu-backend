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
router.post('/upload-image', authMiddleware, adminOnly, uploadMiddleware, uploadImage);

// ── CONTENT BLOCKS (vitrine + hero) — PUBLIC ─────────────────
// GET /api/v1/articles/content-blocks
router.get('/content-blocks', async (req, res) => {
  const pool = require('../config/db');
  try {
    const result = await pool.query(
      `SELECT key, value FROM platform_config WHERE key LIKE 'vitrine_%' ORDER BY key`
    );
    const blocks = {};
    for (const row of result.rows) {
      const blockKey = row.key.replace('vitrine_', '');
      try { blocks[blockKey] = JSON.parse(row.value); }
      catch(e) { blocks[blockKey] = row.value; }
    }
    res.json({ success: true, blocks });
  } catch(err) {
    console.error('[content-blocks GET]', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ── CONTENT BLOCKS — ADMIN SEULEMENT ─────────────────────────
// PUT /api/v1/articles/content-blocks/:key
router.put('/content-blocks/:key', authMiddleware, adminOnly, async (req, res) => {
  const pool = require('../config/db');
  const { key } = req.params;
  const body = req.body;

  // Clés autorisées
  const allowed = ['hero', 'block_patients', 'block_medecins', 'block_pharmacies', 'block_laboratoires'];
  if (!allowed.includes(key)) {
    return res.status(400).json({ success: false, message: `Clé "${key}" non autorisée.` });
  }

  try {
    const configKey = `vitrine_${key}`;
    const value = JSON.stringify(body);
    await pool.query(
      `INSERT INTO platform_config (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [configKey, value]
    );

    // Log audit
    await pool.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, payload)
       VALUES ('vitrine.updated', $1, 'platform_config', $2)`,
      [req.user.phone, JSON.stringify({ key })]
    ).catch(() => {});

    res.json({ success: true, message: `Bloc "${key}" sauvegardé ✅` });
  } catch(err) {
    console.error('[content-blocks PUT]', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur : ' + err.message });
  }
});

// ── ROUTES PUBLIQUES ARTICLES ─────────────────────────────────
router.get('/', getArticles);
router.get('/admin/all', authMiddleware, adminOnly, getAllArticlesAdmin);
router.get('/:id', getArticleById);

// ── ROUTES ADMIN ARTICLES ─────────────────────────────────────
router.post('/',      authMiddleware, adminOnly, createArticle);
router.put('/:id',    authMiddleware, adminOnly, updateArticle);
router.delete('/:id', authMiddleware, adminOnly, deleteArticle);

module.exports = router;