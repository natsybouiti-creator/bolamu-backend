const pool = require('../config/db');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// ── Configuration Cloudinary ──────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Multer : stockage en mémoire, limite 20MB ─────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporté. Utilisez JPG, PNG ou WEBP.'), false);
    }
  },
});

const uploadMiddleware = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          message: 'Fichier trop volumineux. Maximum autorisé : 20MB.'
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'Erreur lors du traitement du fichier.'
      });
    }
    next();
  });
};

// ── Normalise une catégorie libre ────────────────────────────
function normalizeCategory(cat) {
  if (!cat) return 'prevention';
  return cat.toLowerCase().trim()
    .replace(/[àáâ]/g, 'a').replace(/[éèêë]/g, 'e')
    .replace(/[îï]/g, 'i').replace(/[ôö]/g, 'o')
    .replace(/[ùûü]/g, 'u').replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

// ============================================================
// UPLOAD IMAGE — POST /api/v1/articles/upload-image
// Utilisé aussi bien pour les articles que pour la vitrine/hero
// ============================================================
async function uploadImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier reçu.' });
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'bolamu/articles',
          transformation: [
            { width: 1200, height: 630, crop: 'fill', quality: 'auto:good' }
          ],
          resource_type: 'image',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    return res.json({
      success:   true,
      image_url: result.secure_url,
      public_id: result.public_id,
      message:   'Image uploadée avec succès.'
    });
  } catch (err) {
    console.error('[uploadImage]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur upload : ' + err.message });
  }
}

// ============================================================
// 1. LISTER LES ARTICLES (public)
// ============================================================
async function getArticles(req, res) {
  const { category, limit = 20, offset = 0 } = req.query;
  try {
    let query = `SELECT * FROM articles WHERE is_published = true`;
    const params = [];
    if (category && category !== 'tous') {
      params.push(normalizeCategory(category));
      query += ` AND category = $${params.length}`;
    }
    query += ` ORDER BY is_featured DESC, created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));
    const result = await pool.query(query, params);
    const countQuery = category && category !== 'tous'
      ? `SELECT COUNT(*) FROM articles WHERE is_published = true AND category = $1`
      : `SELECT COUNT(*) FROM articles WHERE is_published = true`;
    const countParams = category && category !== 'tous' ? [normalizeCategory(category)] : [];
    const countResult = await pool.query(countQuery, countParams);
    return res.json({ success: true, articles: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) {
    console.error('[getArticles]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

// ============================================================
// 2. UN ARTICLE PAR ID (public)
// ============================================================
async function getArticleById(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM articles WHERE id = $1 AND is_published = true`, [id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Article introuvable' });
    }
    await pool.query(`UPDATE articles SET views = views + 1 WHERE id = $1`, [id]).catch(() => {});
    return res.json({ success: true, article: result.rows[0] });
  } catch (err) {
    console.error('[getArticleById]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

// ============================================================
// 3. CRÉER UN ARTICLE (admin) — catégorie libre
// ============================================================
async function createArticle(req, res) {
  const { title, excerpt, content, category, image_url, emoji, author, read_time, is_published, is_featured } = req.body;
  if (!title || !excerpt || !content || !category) {
    return res.status(400).json({ success: false, message: 'Titre, résumé, contenu et catégorie sont obligatoires.' });
  }
  const cat = normalizeCategory(category);
  try {
    const result = await pool.query(
      `INSERT INTO articles (title, excerpt, content, category, image_url, emoji, author, read_time, is_published, is_featured, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW()) RETURNING *`,
      [title, excerpt, content, cat, image_url||null, emoji||'📄', author||'Dr. Bolamu', read_time||'5 min', is_published!==false, is_featured||false]
    );
    await pool.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('article.create',$1,'articles',$2,$3)`,
      [req.user.phone, result.rows[0].id, JSON.stringify({ title })]
    ).catch(() => {});
    return res.status(201).json({ success: true, article: result.rows[0] });
  } catch (err) {
    console.error('[createArticle]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur : ' + err.message });
  }
}

// ============================================================
// 4. MODIFIER UN ARTICLE (admin)
// ============================================================
async function updateArticle(req, res) {
  const { id } = req.params;
  let { title, excerpt, content, category, image_url, emoji, author, read_time, is_published, is_featured } = req.body;
  if (category) category = normalizeCategory(category);
  try {
    const result = await pool.query(
      `UPDATE articles SET
        title=COALESCE($1,title), excerpt=COALESCE($2,excerpt), content=COALESCE($3,content),
        category=COALESCE($4,category), image_url=COALESCE($5,image_url), emoji=COALESCE($6,emoji),
        author=COALESCE($7,author), read_time=COALESCE($8,read_time),
        is_published=COALESCE($9,is_published), is_featured=COALESCE($10,is_featured), updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [title, excerpt, content, category, image_url, emoji, author, read_time, is_published, is_featured, id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Article introuvable' });
    await pool.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('article.update',$1,'articles',$2,$3)`,
      [req.user.phone, id, JSON.stringify({ title })]
    ).catch(() => {});
    return res.json({ success: true, article: result.rows[0] });
  } catch (err) {
    console.error('[updateArticle]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur : ' + err.message });
  }
}

// ============================================================
// 5. SUPPRIMER UN ARTICLE (admin)
// ============================================================
async function deleteArticle(req, res) {
  const { id } = req.params;
  try {
    const article = await pool.query(`SELECT image_url FROM articles WHERE id = $1`, [id]);
    const result = await pool.query(`DELETE FROM articles WHERE id=$1 RETURNING id,title`, [id]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Article introuvable' });
    if (article.rows[0]?.image_url?.includes('cloudinary')) {
      try {
        const parts = article.rows[0].image_url.split('/');
        const filename = parts[parts.length - 1].split('.')[0];
        await cloudinary.uploader.destroy(`bolamu/articles/${filename}`);
      } catch(e) { /* pas bloquant */ }
    }
    await pool.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('article.delete',$1,'articles',$2,$3)`,
      [req.user.phone, id, JSON.stringify({ title: result.rows[0].title })]
    ).catch(() => {});
    return res.json({ success: true, message: 'Article supprimé' });
  } catch (err) {
    console.error('[deleteArticle]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

// ============================================================
// 6. TOUS LES ARTICLES pour l'admin
// ============================================================
async function getAllArticlesAdmin(req, res) {
  try {
    const result = await pool.query(`SELECT * FROM articles ORDER BY created_at DESC`);
    return res.json({ success: true, articles: result.rows });
  } catch (err) {
    console.error('[getAllArticlesAdmin]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

module.exports = {
  uploadMiddleware,
  uploadImage,
  getArticles,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
  getAllArticlesAdmin
};