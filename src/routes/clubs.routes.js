// ============================================================
// BOLAMU — Sprint 2 : Clubs Routes
// ============================================================
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { uploadToCloudinary } = require('../utils/cloudinary');
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});
const handleMulterError = (err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'Fichier trop volumineux (max 5MB)' });
  }
  next(err);
};
const {
  getClubs,
  getClubById,
  joinClub,
  leaveClub,
  getMyClubs,
  getClubMessages,
  sendClubMessage,
  kickMember,
  deactivateClub
} = require('../controllers/clubs.controller');

// Public
router.get('/', getClubs);

// Patient connecté
// IMPORTANT : /my doit être déclaré AVANT /:id, sinon Express capture "my" comme valeur de :id
// (cause du bug "invalid input syntax for type integer: 'my'" sur getClubById)
router.get('/my', authMiddleware, getMyClubs);

router.get('/:id', getClubById);
router.post('/:id/join', authMiddleware, joinClub);
router.delete('/:id/join', authMiddleware, leaveClub);

// Chat interne au club (membres uniquement)
router.get('/:id/messages', authMiddleware, getClubMessages);
router.post('/:id/messages', authMiddleware, sendClubMessage);

// Administration (réservé animateur du club, ou admin pour la désactivation)
router.post('/:id/kick/:phone', authMiddleware, kickMember);
router.delete('/:id', authMiddleware, deactivateClub);

// Créer un club
router.post('/', authMiddleware, upload.single('cover'), handleMulterError, async (req, res) => {
  const pool = require('../config/db');
  const client = await pool.connect();
  try {
    const { name, description, category, sport_type } = req.body;
    const myPhone = req.user.phone;

    if (!name) {
      client.release();
      return res.status(400).json({ success: false, message: 'name requis' });
    }

    let coverImagePath = null;
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer, 'bolamu/clubs', {
        public_id: `club_cover_${Date.now()}`,
        transformation: { width: 600, height: 300, crop: 'fill' }
      });
      coverImagePath = uploadResult.secure_url;
    }

    await client.query('BEGIN');

    const result = await client.query(`
      INSERT INTO clubs (name, description, category, animateur_phone, cover_image_path, created_at, is_active)
      VALUES ($1, $2, $3, $4, $5, NOW(), true)
      RETURNING id, name, description, category, cover_image_path
    `, [name, description || category || sport_type || 'Sport', category || sport_type || 'Sport', myPhone, coverImagePath]);

    const club = result.rows[0];

    // Créer la conversation de chat du club et y ajouter le créateur
    const convResult = await client.query(`
      INSERT INTO conversations (type, club_id, title, created_at, is_active)
      VALUES ('club', $1, $2, NOW(), true)
      RETURNING id
    `, [club.id, name]);

    const conversationId = convResult.rows[0].id;

    await client.query(`UPDATE clubs SET conversation_id = $1 WHERE id = $2`, [conversationId, club.id]);

    await client.query(`
      INSERT INTO conversation_participants (conversation_id, participant_phone, role, joined_at)
      VALUES ($1, $2, 'animateur', NOW())
    `, [conversationId, myPhone]);

    await client.query('COMMIT');

    res.json({ success: true, data: { ...club, conversation_id: conversationId } });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// Modifier la photo de couverture du club (réservé à l'animateur)
router.patch('/:id/cover', authMiddleware, upload.single('cover'), handleMulterError, async (req, res) => {
  const pool = require('../config/db');
  const { normalizePhone } = require('../utils/phone');
  const client = await pool.connect();
  try {
    if (!req.file) {
      client.release();
      return res.status(400).json({ success: false, message: 'Aucune image fournie' });
    }

    const { id } = req.params;
    const requesterPhone = normalizePhone(req.user.phone);

    await client.query('BEGIN');

    const clubResult = await client.query(
      `SELECT id, animateur_phone, cover_image_path FROM clubs WHERE id = $1 AND is_active = TRUE`,
      [id]
    );

    if (clubResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ success: false, message: 'Club introuvable' });
    }

    const club = clubResult.rows[0];

    if (club.animateur_phone !== requesterPhone) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(403).json({ success: false, message: 'Réservé à l\'animateur du club' });
    }

    const uploadResult = await uploadToCloudinary(req.file.buffer, 'bolamu/clubs', {
      public_id: `club_cover_${id}_${Date.now()}`,
      transformation: { width: 600, height: 300, crop: 'fill' }
    });

    await client.query(
      `UPDATE clubs SET cover_image_path = $1 WHERE id = $2`,
      [uploadResult.secure_url, id]
    );

    await client.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('club_cover_updated', $1, 'clubs', $2, $3::jsonb)`,
      [requesterPhone, id, JSON.stringify({ old: club.cover_image_path, new: uploadResult.secure_url })]
    );

    await client.query('COMMIT');

    res.json({ success: true, cover_image_path: uploadResult.secure_url });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[CLUBS] Erreur update cover:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  } finally {
    client.release();
  }
});

// Patient connecté - Liste des membres du club avec Zora points
router.get('/:id/members', authMiddleware, async (req, res) => {
  try {
    const pool = require('../config/db');
    const clubId = req.params.id;
    
    const result = await pool.query(`
      SELECT u.phone, u.first_name, u.last_name, u.photo_url,
        COALESCE(SUM(zl.points), 0) AS zora_points
      FROM club_members cm
      JOIN users u ON u.phone = cm.patient_phone
      LEFT JOIN zora_ledger zl ON zl.phone = cm.patient_phone
      WHERE cm.club_id = $1
      GROUP BY u.phone, u.first_name, u.last_name, u.photo_url
      ORDER BY zora_points DESC
    `, [clubId]);
    
    const members = result.rows.map(m => ({
      phone: m.phone,
      full_name: `${m.first_name || ''} ${m.last_name || ''}`.trim() || 'Membre',
      photo_url: m.photo_url,
      zora_points: parseInt(m.zora_points) || 0
    }));
    
    res.json({ success: true, data: members });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
