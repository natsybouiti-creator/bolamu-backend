// ============================================================
// BOLAMU — Routes Pharmacies
// ============================================================
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { registerPharmacie, getPharmacieProfile, updatePharmacieStatus, getOrdonnancesEnAttenteHandler, dispenserOrdonnanceHandler, getStatsHandler } = require('../controllers/pharmacie.controller');
const authMiddleware = require('../middleware/auth.middleware');
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { normalizePhone } = require('../utils/phone');
const { uploadToCloudinary } = require('../utils/cloudinary');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Format non supporté.'));
    }
});

const handleMulterError = (err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'Fichier trop volumineux (max 5MB)' });
  }
  next(err);
};

router.post('/register', upload.single('document'), registerPharmacie);
router.get('/profil', authMiddleware, getPharmacieProfile);
router.patch('/:id/status', authMiddleware.requireAdmin, updatePharmacieStatus);
router.get('/ordonnances/attente', authMiddleware, getOrdonnancesEnAttenteHandler);
router.post('/ordonnances/dispenser', authMiddleware, dispenserOrdonnanceHandler);
router.get('/stats', authMiddleware, getStatsHandler);

router.get('/all', authMiddleware, async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    try {
        const result = await pool.query(
            `SELECT * FROM users WHERE role = 'pharmacie' ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        res.json({ success: true, data: result.rows });
    } catch (e) { res.status(500).json({ success: false, message: 'Erreur serveur.' }); }
});

router.post('/change-password', authMiddleware, async (req, res) => {
  const phone = req.user.phone;
  const { old_password, new_password } = req.body;
  if (!old_password || !new_password) return res.status(400).json({ success: false, message: 'Champs manquants' });
  if (new_password.length < 6) return res.status(400).json({ success: false, message: 'Le nouveau mot de passe doit faire au moins 6 caractères' });
  try {
    const result = await pool.query(`SELECT password_hash FROM users WHERE phone = $1`, [phone]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Compte introuvable' });
    const valid = await bcrypt.compare(old_password, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ success: false, message: 'Ancien mot de passe incorrect' });
    const newHash = await bcrypt.hash(new_password, 10);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE phone = $2`, [newHash, phone]);
    res.json({ success: true, message: 'Mot de passe modifié avec succès' });
  } catch(e) {
    console.error('[change-password]', e.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/v1/pharmacies/photo - Upload photo de profil
router.post('/photo', authMiddleware, upload.single('photo'), handleMulterError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucune photo fournie' });
    }

    const phone = normalizePhone(req.user.phone);

    // Upload vers Cloudinary
    const uploadResult = await uploadToCloudinary(req.file.buffer, 'bolamu/photos', {
      public_id: `pharmacie_${phone}_${Date.now()}`,
      transformation: { width: 400, height: 400, crop: 'fill' }
    });

    // Mettre à jour la table pharmacies
    const r = await pool.query(
      'UPDATE pharmacies SET photo_url = $1 WHERE phone = $2',
      [uploadResult.secure_url, phone]
    );
    if (r.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Profil pharmacie introuvable' });
    }

    // Mettre à jour la table users aussi pour cohérence
    await pool.query(
      'UPDATE users SET photo_url = $1 WHERE phone = $2',
      [uploadResult.secure_url, phone]
    );

    res.json({ success: true, photo_url: uploadResult.secure_url });
  } catch (err) {
    console.error('[pharmacie-photo]', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
