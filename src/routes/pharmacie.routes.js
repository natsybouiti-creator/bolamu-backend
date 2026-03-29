// ============================================================
// BOLAMU — Routes Pharmacies
// ============================================================
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { registerPharmacie, getPharmacieProfile, updatePharmacieStatus } = require('../controllers/pharmacie.controller');
const authMiddleware = require('../../middleware/auth.middleware');

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
        const result = await pool.query(`SELECT * FROM pharmacies ORDER BY created_at DESC`);
        res.json({ success: true, data: result.rows });
    } catch (e) { res.status(500).json({ success: false, message: 'Erreur serveur.' }); }
});

module.exports = router;