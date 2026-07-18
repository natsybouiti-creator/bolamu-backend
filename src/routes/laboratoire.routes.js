// ============================================================
// BOLAMU — Routes Laboratoires
// ============================================================
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { registerLaboratoire, getLaboratoireProfile, updateLaboratoireStatus, getLaboratoires, updateLaboratoireProfile } = require('../controllers/laboratoire.controller');
const authMiddleware = require('../middleware/auth.middleware');
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

router.post('/register', upload.single('document'), registerLaboratoire);
router.get('/profil', authMiddleware, getLaboratoireProfile);
router.patch('/:id/status', authMiddleware.requireAdmin, updateLaboratoireStatus);

// Modifier le profil laboratoire
router.patch('/profil', authMiddleware, updateLaboratoireProfile);

// Rechercher laboratoires avec filtres et pagination
router.get('/', getLaboratoires);

router.get('/all', authMiddleware, async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    try {
        const result = await pool.query(
            `SELECT * FROM users WHERE role = 'laboratoire' ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        res.json({ success: true, data: result.rows });
    } catch (e) { res.status(500).json({ success: false, message: 'Erreur serveur.' }); }
});

// POST /api/v1/laboratories/photo - Upload photo de profil
router.post('/photo', authMiddleware, upload.single('photo'), handleMulterError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucune photo fournie' });
    }

    const phone = normalizePhone(req.user.phone);

    // Upload vers Cloudinary
    const uploadResult = await uploadToCloudinary(req.file.buffer, 'bolamu/photos', {
      public_id: `laboratoire_${phone}_${Date.now()}`,
      transformation: { width: 400, height: 400, crop: 'fill' }
    });

    // Mettre à jour la table laboratories
    const r = await pool.query(
      'UPDATE laboratories SET photo_url = $1 WHERE phone = $2',
      [uploadResult.secure_url, phone]
    );
    if (r.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Profil laboratoire introuvable' });
    }

    // Mettre à jour la table users aussi pour cohérence
    await pool.query(
      'UPDATE users SET photo_url = $1 WHERE phone = $2',
      [uploadResult.secure_url, phone]
    );

    res.json({ success: true, photo_url: uploadResult.secure_url });
  } catch (err) {
    console.error('[laboratoire-photo]', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;