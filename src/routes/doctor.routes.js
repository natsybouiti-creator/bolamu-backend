const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { registerDoctor, getDoctors } = require('../controllers/doctor.controller');
const authMiddleware = require('../../middleware/auth.middleware');

// POST /api/v1/doctors/register
router.post('/register', registerDoctor);

// GET /api/v1/doctors
router.get('/', getDoctors);

// GET /api/v1/doctors/profil?phone=+242060000001
router.get('/profil', authMiddleware, async (req, res) => {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone requis.' });

    try {
        const result = await pool.query(
            `SELECT id, full_name, phone, specialty, registration_number,
                    status, member_code, availability_schedule, created_at
             FROM doctors WHERE phone = $1`,
            [phone]
        );
        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: 'Médecin introuvable.' });
        }

        // Générer member_code si absent
        const doc = result.rows[0];
        if (!doc.member_code) {
            const digits = phone.replace(/\D/g,'').slice(-8);
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let code = '';
            for (let i=0;i<8;i+=2){ const n=parseInt(digits.slice(i,i+2)); code+=chars[n%chars.length]; }
            doc.member_code = 'MED-' + code.slice(0,4);
        }

        res.json({ success: true, data: doc });
    } catch (err) {
        console.error('[profil]', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;