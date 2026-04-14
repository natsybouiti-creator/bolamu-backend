const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const pool = require('../config/db');
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

// ── CONTENT BLOCKS (Vitrine & Hero) ──────────────────────────
// Stockage dans une table dédiée créée à la volée si besoin
async function ensureVitrineTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vitrine_blocks (
      id SERIAL PRIMARY KEY,
      block_key VARCHAR(100) UNIQUE NOT NULL,
      block_value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// GET public — index.html charge les blocs vitrine
router.get('/content-blocks', async (req, res) => {
  try {
    await ensureVitrineTable();
    const result = await pool.query(`SELECT block_key, block_value FROM vitrine_blocks`);
    const blocks = {};
    result.rows.forEach(row => {
      try { blocks[row.block_key] = JSON.parse(row.block_value); }
      catch(e) { blocks[row.block_key] = row.block_value; }
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
    await ensureVitrineTable();
    await pool.query(
      `INSERT INTO vitrine_blocks (block_key, block_value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (block_key) DO UPDATE SET block_value = $2, updated_at = NOW()`,
      [key, value]
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