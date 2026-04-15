// routes/articles.routes.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth.middleware');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// ─── INIT CLOUDINARY (lazy) ───────────────────────────────────
function initCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// ─── HELPER upload buffer vers Cloudinary ────────────────────
async function uploadToCloudinary(buffer, folder) {
  initCloudinary();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', quality: 'auto', fetch_format: 'auto' },
      (err, result) => { if (err) reject(err); else resolve(result.secure_url); }
    );
    stream.end(buffer);
  });
}

// ════════════════════════════════════════════════════════════════
//  ARTICLES — publics
// ════════════════════════════════════════════════════════════════

// GET /api/v1/articles — liste publiés
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    let q = 'SELECT * FROM articles WHERE is_published = TRUE';
    const params = [];
    if (category && category !== 'tous') { q += ' AND category = $1'; params.push(category); }
    q += ' ORDER BY is_featured DESC, created_at DESC';
    const { rows } = await pool.query(q, params);
    res.json({ success: true, articles: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/v1/articles/:id — article unique
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM articles WHERE id = $1 AND is_published = TRUE', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Article introuvable' });
    res.json({ success: true, article: rows[0] });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ════════════════════════════════════════════════════════════════
//  CONTENT BLOCKS — public (pour index.html)
// ════════════════════════════════════════════════════════════════

// GET /api/v1/articles/content-blocks — tous les blocs de contenu
router.get('/content-blocks', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT block_key, content FROM content_blocks ORDER BY block_key');
    const blocks = {};
    rows.forEach(r => { blocks[r.block_key] = r.content; });
    res.json({ success: true, blocks });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ════════════════════════════════════════════════════════════════
//  ADMIN — articles
// ════════════════════════════════════════════════════════════════

// GET /api/v1/articles/admin/all
router.get('/admin/all', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const { rows } = await pool.query('SELECT * FROM articles ORDER BY created_at DESC');
    res.json({ success: true, articles: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/v1/articles — créer article
router.post('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const { title, excerpt, content, category, author, read_time, emoji, image_url, is_published, is_featured } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Titre requis' });
    const { rows } = await pool.query(
      `INSERT INTO articles (title, excerpt, content, category, author, read_time, emoji, image_url, is_published, is_featured)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [title, excerpt||'', content||'', category||'prevention', author||'Dr. Bolamu', read_time||'5 min', emoji||'📄', image_url||'', is_published||false, is_featured||false]
    );
    await pool.query(`INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('article.create',$1,'articles',$2,$3)`,
      [req.user.phone, rows[0].id, JSON.stringify({ title })]);
    res.json({ success: true, article: rows[0] });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// PUT /api/v1/articles/:id — modifier article
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const fields = ['title','excerpt','content','category','author','read_time','emoji','image_url','is_published','is_featured'];
    const updates = []; const vals = [];
    fields.forEach(f => { if (req.body[f] !== undefined) { updates.push(`${f}=$${vals.length+1}`); vals.push(req.body[f]); } });
    if (!updates.length) return res.status(400).json({ success: false, message: 'Rien à mettre à jour' });
    updates.push(`updated_at=NOW()`);
    vals.push(req.params.id);
    const { rows } = await pool.query(`UPDATE articles SET ${updates.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Article introuvable' });
    res.json({ success: true, article: rows[0] });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// DELETE /api/v1/articles/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const { rows } = await pool.query('DELETE FROM articles WHERE id=$1 RETURNING id, title', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Article introuvable' });
    await pool.query(`INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('article.delete',$1,'articles',$2,$3)`,
      [req.user.phone, rows[0].id, JSON.stringify({ title: rows[0].title })]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/v1/articles/upload-image — upload image article
router.post('/upload-image', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    if (!req.file) return res.status(400).json({ success: false, message: 'Aucune image' });
    const url = await uploadToCloudinary(req.file.buffer, 'bolamu/articles');
    res.json({ success: true, url });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ════════════════════════════════════════════════════════════════
//  ADMIN — CONTENT BLOCKS (vitrine, plans, textes, réseaux)
// ════════════════════════════════════════════════════════════════

// GET /api/v1/articles/admin/content-blocks — tous les blocs (admin)
router.get('/admin/content-blocks', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const { rows } = await pool.query('SELECT * FROM content_blocks ORDER BY block_key');
    const blocks = {};
    rows.forEach(r => { blocks[r.block_key] = r.content; });
    res.json({ success: true, blocks, rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// PUT /api/v1/articles/admin/content-blocks/:key — upsert un bloc
router.put('/admin/content-blocks/:key', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const { key } = req.params;
    const { content } = req.body;
    if (!content) return res.status(400).json({ success: false, message: 'content requis' });
    await pool.query(
      `INSERT INTO content_blocks (block_key, content, updated_at) VALUES ($1,$2,NOW())
       ON CONFLICT (block_key) DO UPDATE SET content=$2, updated_at=NOW()`,
      [key, JSON.stringify(content)]
    );
    await pool.query(`INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('content.update',$1,'content_blocks',0,$2)`,
      [req.user.phone, JSON.stringify({ key })]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/v1/articles/admin/upload-vitrine — upload image vitrine/plans
router.post('/admin/upload-vitrine', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    if (!req.file) return res.status(400).json({ success: false, message: 'Aucune image' });
    const url = await uploadToCloudinary(req.file.buffer, 'bolamu/vitrine');
    res.json({ success: true, url });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;