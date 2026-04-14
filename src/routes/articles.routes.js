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

// ── UPLOAD IMAGE ─────────────────────────────────────────────
router.post('/upload-image', authMiddleware, adminOnly, uploadMiddleware, uploadImage);

// ── CONTENT BLOCKS — Vitrine & Hero ──────────────────────────
router.get('/content-blocks', async (req, res) => {
  try {
    await ensureVitrineTable();
    const result = await pool.query(`SELECT block_key, block_value FROM vitrine_blocks WHERE block_key NOT LIKE 'plan_%'`);
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

router.put('/content-blocks/:key', authMiddleware, adminOnly, async (req, res) => {
  const { key } = req.params;
  const value = JSON.stringify(req.body);
  try {
    await ensureVitrineTable();
    await pool.query(
      `INSERT INTO vitrine_blocks (block_key, block_value, updated_at) VALUES ($1,$2,NOW())
       ON CONFLICT (block_key) DO UPDATE SET block_value=$2, updated_at=NOW()`,
      [key, value]
    );
    return res.json({ success: true, message: 'Bloc sauvegardé' });
  } catch (err) {
    console.error('[content-blocks PUT]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ── PLANS & TARIFS ───────────────────────────────────────────
const DEFAULT_PLANS = {
  essentiel: { name:'Essentiel', price:1000, period:'/ mois', badge:'', color:'#2E86FF', features:['Accès aux médecins généralistes','3 consultations/mois','Ordonnances numériques','Dossier médical sécurisé'], recommended:false },
  standard:  { name:'Standard',  price:2500, period:'/ mois', badge:'Recommandé', color:'#00C9A7', features:['Accès médecins spécialistes','Consultations illimitées','Ordonnances + pharmacies partenaires','Suivi grossesse inclus','Résultats labo en ligne'], recommended:true },
  premium:   { name:'Premium',   price:5000, period:'/ mois', badge:'', color:'#7C3AED', features:['Tout Standard inclus','Médecin référent dédié','Priorité immédiate 24h/7j','Famille incluse (4 membres)','Bilan de santé annuel'], recommended:false }
};

router.get('/plans', async (req, res) => {
  try {
    await ensureVitrineTable();
    const result = await pool.query(`SELECT block_key, block_value FROM vitrine_blocks WHERE block_key LIKE 'plan_%'`);
    const plans = { ...DEFAULT_PLANS };
    result.rows.forEach(row => {
      const key = row.block_key.replace('plan_', '');
      try { plans[key] = JSON.parse(row.block_value); }
      catch(e) {}
    });
    return res.json({ success: true, plans });
  } catch (err) {
    console.error('[plans GET]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

router.put('/plans/:key', authMiddleware, adminOnly, async (req, res) => {
  const { key } = req.params;
  const value = JSON.stringify(req.body);
  try {
    await ensureVitrineTable();
    await pool.query(
      `INSERT INTO vitrine_blocks (block_key, block_value, updated_at) VALUES ($1,$2,NOW())
       ON CONFLICT (block_key) DO UPDATE SET block_value=$2, updated_at=NOW()`,
      [`plan_${key}`, value]
    );
    return res.json({ success: true, message: 'Plan sauvegardé' });
  } catch (err) {
    console.error('[plans PUT]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ── ROUTES ARTICLES ───────────────────────────────────────────
router.get('/', getArticles);
router.get('/admin/all', authMiddleware, adminOnly, getAllArticlesAdmin);
router.get('/:id', getArticleById);
router.post('/',      authMiddleware, adminOnly, createArticle);
router.put('/:id',    authMiddleware, adminOnly, updateArticle);
router.delete('/:id', authMiddleware, adminOnly, deleteArticle);

module.exports = router;