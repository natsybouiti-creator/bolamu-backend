const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../config/db');
const { registerDoctor, getDoctors, updateDoctorStatus } = require('../controllers/doctor.controller');
const authMiddleware = require('../../middleware/auth.middleware');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});

router.post('/register', upload.single('document'), registerDoctor);
router.get('/', getDoctors);

router.get('/pending', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM doctors WHERE status = 'pending'`);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

router.patch('/:id/status', authMiddleware, updateDoctorStatus);

router.get('/profil', authMiddleware, async (req, res) => {
    const { phone } = req.query;
    try {
        const result = await pool.query(`SELECT * FROM doctors WHERE phone = $1`, [phone]);
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;