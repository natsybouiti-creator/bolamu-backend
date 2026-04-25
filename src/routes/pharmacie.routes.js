// ============================================================
// BOLAMU — Routes Pharmacies
// ============================================================
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { registerPharmacie, getPharmacieProfile, updatePharmacieStatus } = require('../controllers/pharmacie.controller');
const authMiddleware = require('../../middleware/auth.middleware');
const bcrypt = require('bcrypt');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Format non supporté.'));
    }
});

router.post('/register', upload.single('document'), registerPharmacie);
router.get('/profil', authMiddleware, getPharmacieProfile);
router.patch('/:id/status', authMiddleware, updatePharmacieStatus);

router.get('/all', authMiddleware, async (req, res) => {
    const pool = require('../config/db');
    try {
        const result = await pool.query(`SELECT * FROM users WHERE role = 'pharmacie' ORDER BY created_at DESC`);
        res.json({ success: true, data: result.rows });
    } catch (e) { res.status(500).json({ success: false, message: 'Erreur serveur.' }); }
});

router.post('/change-password', authMiddleware, async (req, res) => {
  const { phone, old_password, new_password } = req.body;
  if (!phone || !old_password || !new_password) return res.status(400).json({ success: false, message: 'Champs manquants' });
  if (new_password.length < 6) return res.status(400).json({ success: false, message: 'Le nouveau mot de passe doit faire au moins 6 caractères' });
  try {
    const pool = require('../config/db');
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

module.exports = router;