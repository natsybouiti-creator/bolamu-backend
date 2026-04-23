const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../config/db');
const { registerDoctor, getDoctors, updateDoctorStatus, getDoctorProfile } = require('../controllers/doctor.controller');
const authMiddleware = require('../../middleware/auth.middleware');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});

router.post('/register', upload.single('document'), registerDoctor);
router.get('/', getDoctors);

router.get('/pending', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM users WHERE role = 'doctor' AND is_active = false`);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

router.patch('/:id/status', authMiddleware, updateDoctorStatus);

router.get('/profil', authMiddleware, getDoctorProfile);

module.exports = router;