const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../config/db');
const { registerDoctor, getDoctors, updateDoctorStatus } = require('../controllers/doctor.controller');
const authMiddleware = require('../../middleware/auth.middleware');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Format non supporté.'));
    }
});

// POST /api/v1/doctors/register
router.post('/register', upload.single('document'), registerDoctor);

// GET /api/v1/doctors
router.get('/', getDoctors);

// GET /api/v1/doctors/pending (admin)
router.get('/pending', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, full_name, phone, specialty, registration_number,
                    city, status, trust_score, document_url, created_at
             FROM doctors WHERE status = 'pending' ORDER BY created_at DESC`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// GET /api/v1/doctors/all (admin)
router.get('/all', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, full_name, phone, specialty, registration_number,
                    city, status, trust_score, document_url, is_active,
                    total_consultations, member_code, created_at
             FROM doctors ORDER BY created_at DESC`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// PATCH /api/v1/doctors/:id/status (admin)
router.patch('/:id/status', authMiddleware, updateDoctorStatus);

// GET /api/v1/doctors/profil?phone=
router.get('/profil', authMiddleware, async (req, res) => {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone requis.' });

    try {
        const result = await pool.query(
            `SELECT id, full_name, phone, specialty, registration_number,
                    status, member_code, availability_schedule, trust_score,
                    document_url, city, neighborhood, bio, created_at
             FROM doctors WHERE phone = $1`,
            [phone]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Médecin introuvable.' });

        const doc = result.rows[0];
        if (!doc.member_code) {
            const digits = phone.replace(/\D/g, '').slice(-8);
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let code = '';
            for (let i = 0; i < 8; i += 2) { const n = parseInt(digits.slice(i, i + 2)); code += chars[n % chars.length]; }
            doc.member_code = 'MED-' + code.slice(0, 4);
        }

        res.json({ success: true, data: doc });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;