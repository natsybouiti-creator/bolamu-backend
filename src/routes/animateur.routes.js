// ============================================================
// BOLAMU — Routes Animateur (Sprint 3)
// ============================================================
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const { uploadToCloudinary } = require('../utils/cloudinary');
const { normalizePhone } = require('../utils/phone');
const multer = require('multer');
const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const handleMulterError = (err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'Fichier trop volumineux (max 5MB)' });
  }
  next(err);
};
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth.middleware');
const { 
  getStats, 
  getMyEvents, 
  createElongaEvent, 
  getMyClubs, 
  getTodayCheckins, 
  checkinPatient, 
  notifyClub,
  getEventRegistrations 
} = require('../controllers/animateur.controller');
const logger = require('../config/logger');
const { upload, uploadEvent } = require('../middleware/uploadEvent');

if (!process.env.JWT_SECRET) {
    throw new Error('[FATAL] JWT_SECRET non défini. Configurez cette variable dans Render.');
}
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware inline — accès animateur uniquement
const requireAnimateur = [authMiddleware, (req, res, next) => {
    if (!req.user || req.user.role !== 'animateur') {
        return res.status(403).json({ success: false, message: 'Accès réservé aux animateurs Bolamu' });
    }
    next();
}];

// ─── POST /login ──────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const rawPhone = req.body.phone;
        const { password } = req.body;

        if (!rawPhone || !password) {
            return res.status(400).json({ success: false, message: 'Numéro et mot de passe requis' });
        }

        const phone = normalizePhone(rawPhone);
        const result = await pool.query(
            `SELECT id, full_name, phone, password_hash, role, is_active
             FROM users
             WHERE phone = $1 AND role = 'animateur'`,
            [phone]
        );

        if (!result.rows.length) {
            return res.status(401).json({ success: false, message: 'Compte animateur introuvable' });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(403).json({ success: false, message: 'Compte inactif — contactez le support Bolamu' });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ success: false, message: 'Mot de passe incorrect' });
        }

        const token = jwt.sign(
            { id: user.id, phone: user.phone, role: user.role, is_active: true },
            JWT_SECRET,
            { expiresIn: '12h' }
        );

        res.json({
            success: true,
            token,
            animateur: { id: user.id, full_name: user.full_name, phone: user.phone }
        });
    } catch (err) {
        logger.error('[ANIMATEUR LOGIN]', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── GET /stats ───────────────────────────────────────────────────────────────
router.get('/stats', requireAnimateur, getStats);

// ─── GET /events ──────────────────────────────────────────────────────────────
router.get('/events', requireAnimateur, getMyEvents);

// ─── POST /events ─────────────────────────────────────────────────────────────
router.post('/events', requireAnimateur, upload.single('cover'), uploadEvent, createElongaEvent);

// ─── GET /clubs ───────────────────────────────────────────────────────────────
router.get('/clubs', requireAnimateur, getMyClubs);

// ─── GET /events/:id/registrations ───────────────────────────────────────────────
router.get('/events/:id/registrations', requireAnimateur, getEventRegistrations);

// ─── GET /checkins/today ────────────────────────────────────────────────────────
router.get('/checkins/today', requireAnimateur, getTodayCheckins);

// ─── POST /events/:id/checkin ────────────────────────────────────────────────────
router.post('/events/:id/checkin', requireAnimateur, checkinPatient);

// ─── POST /clubs/:id/notify ───────────────────────────────────────────────────
router.post('/clubs/:id/notify', requireAnimateur, notifyClub);

// POST /api/v1/animateur/photo - Upload photo de profil
router.post('/photo', requireAnimateur, photoUpload.single('photo'), handleMulterError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucune photo fournie' });
    }

    const phone = normalizePhone(req.user.phone);

    // Upload vers Cloudinary
    const uploadResult = await uploadToCloudinary(req.file.buffer, 'bolamu/photos', {
      public_id: `animateur_${phone}_${Date.now()}`,
      transformation: { width: 400, height: 400, crop: 'fill' }
    });

    // Mettre à jour la table animateurs
    const r = await pool.query(
      'UPDATE animateurs SET photo_url = $1 WHERE phone = $2',
      [uploadResult.secure_url, phone]
    );
    if (r.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Profil animateur introuvable' });
    }

    // Mettre à jour la table users aussi pour cohérence
    await pool.query(
      'UPDATE users SET photo_url = $1 WHERE phone = $2',
      [uploadResult.secure_url, phone]
    );

    res.json({ success: true, photo_url: uploadResult.secure_url });
  } catch (err) {
    console.error('[animateur-photo]', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
