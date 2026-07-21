const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../config/db');
const { registerDoctor, getDoctors, updateDoctorStatus, getDoctorProfile, generatePatientQRCode, createTimeSlot, getTimeSlots, updateTimeSlot, updateDoctorProfile, deleteTimeSlot } = require('../controllers/doctor.controller');
const authMiddleware = require('../middleware/auth.middleware');
const bcrypt = require('bcrypt');
const { uploadToCloudinary } = require('../utils/cloudinary');
const { normalizePhone } = require('../utils/phone');
const { strictLimiter } = require('../middleware/rateLimiter');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});

// Middleware pour restreindre aux médecins
const doctorOnly = (req, res, next) => {
    if (req.user?.role !== 'doctor') {
        return res.status(403).json({ success: false, message: 'Accès réservé aux médecins.' });
    }
    next();
};

router.post('/register', strictLimiter, upload.single('document'), registerDoctor);
router.get('/', getDoctors);

router.get('/pending', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM users WHERE role = 'doctor' AND is_active = false LIMIT 500`);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

router.patch('/:id/status', authMiddleware.requireAdmin, updateDoctorStatus);

router.get('/profil', authMiddleware, doctorOnly, getDoctorProfile);

// Modifier le profil médecin
router.patch('/profil', authMiddleware, doctorOnly, updateDoctorProfile);

// Générer QR Code pour un patient (côté médecin)
router.get('/patients/:phone/qrcode', authMiddleware, generatePatientQRCode);

// Recherche patients (accessible aux médecins)
router.get('/patients/search', authMiddleware, doctorOnly, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ success: true, data: [] });
    }

    const searchTerm = `%${q}%`;
    const result = await pool.query(
      `SELECT u.phone, u.full_name, u.photo_url, u.city, u.is_active
       FROM users u
       WHERE u.role = 'patient'
       AND u.is_active = true
       AND (u.full_name ILIKE $1 OR u.phone ILIKE $1)
       ORDER BY u.full_name
       LIMIT 20`,
      [searchTerm]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[doctor-patients-search]', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créneaux horaires
router.post('/slots', authMiddleware, createTimeSlot);
router.get('/slots', authMiddleware, getTimeSlots);
router.patch('/slots/:id', authMiddleware, updateTimeSlot);
router.delete('/slots/:id', authMiddleware, deleteTimeSlot);

router.post('/change-password', authMiddleware, strictLimiter, async (req, res) => {
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

// POST /api/v1/doctors/photo - Upload photo de profil
router.post('/photo', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucune photo fournie' });
    }

    const phone = normalizePhone(req.user.phone);

    // Upload vers Cloudinary
    const uploadResult = await uploadToCloudinary(req.file.buffer, 'bolamu/photos', {
      public_id: `doctor_${phone}_${Date.now()}`,
      transformation: { width: 400, height: 400, crop: 'fill' }
    });

    // Mettre à jour la table doctors
    await pool.query(
      'UPDATE doctors SET photo_url = $1 WHERE phone = $2',
      [uploadResult.secure_url, phone]
    );

    // Mettre à jour la table users aussi pour cohérence
    await pool.query(
      'UPDATE users SET photo_url = $1 WHERE phone = $2',
      [uploadResult.secure_url, phone]
    );

    res.json({ success: true, photo_url: uploadResult.secure_url });
  } catch (err) {
    console.error('[doctor-photo]', err.message);
    
    // Gestion spécifique erreur multer LIMIT_FILE_SIZE
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, message: 'Fichier trop volumineux (max 5MB)' });
    }
    
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;