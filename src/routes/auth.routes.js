const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth.middleware');

const {
    requestOtp,
    verifyOtp,
    login,
    registerPatient,
    registerDoctor,
    registerPharmacie,
    registerLaboratoire
} = require('../controllers/auth.controller');

// â”€â”€â”€ OTP & LOGIN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/request-otp', requestOtp);
router.post('/verify-otp', verifyOtp);
router.post('/login', login);

// â”€â”€â”€ REGISTER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/register/patient',     registerPatient);
router.post('/register/doctor',      registerDoctor);
router.post('/register/pharmacie',   registerPharmacie);
router.post('/register/laboratoire', registerLaboratoire);

// â”€â”€â”€ LOGIN ADMIN SÃ‰CURISÃ‰ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'bolamu_cle_secrete_brazzaville_2026';

router.post('/admin-login', async (req, res) => {
    const { phone, password } = req.body;

    if (!phone || !password) {
        return res.status(400).json({ success: false, message: 'TÃ©lÃ©phone et mot de passe requis.' });
    }

    try {
        const result = await pool.query(
            `SELECT id, phone, full_name, role, is_active, banned, admin_password FROM users WHERE phone = $1 AND role = 'admin'`,
            [phone]
        );

        if (!result.rows.length) {
            await pool.query(
                `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('admin.login_failed', $1, 'users', NULL, $2)`,
                [phone, JSON.stringify({ reason: 'phone_not_found' })]
            ).catch(() => {});
            return res.status(401).json({ success: false, message: 'AccÃ¨s refusÃ©.' });
        }

        const user = result.rows[0];

        if (!user.is_active || user.banned) {
            return res.status(403).json({ success: false, message: 'Compte dÃ©sactivÃ©.' });
        }

        if (!user.admin_password || user.admin_password !== password) {
            await pool.query(
                `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('admin.login_failed', $1, 'users', $2, $3)`,
                [phone, user.id, JSON.stringify({ reason: 'wrong_password' })]
            ).catch(() => {});
            return res.status(401).json({ success: false, message: 'Mot de passe incorrect.' });
        }

        const token = jwt.sign({ id: user.id, phone: user.phone, role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });

        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('admin.login_success', $1, 'users', $2, $3)`,
            [phone, user.id, JSON.stringify({ timestamp: new Date().toISOString() })]
        ).catch(() => {});

        return res.json({ success: true, token, phone: user.phone, role: 'admin', full_name: user.full_name, redirectUrl: '/admin/dashboard.html' });

    } catch (err) {
        console.error('[admin-login]', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// â”€â”€â”€ GET /api/v1/auth/me â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/me', authMiddleware, (req, res) => {
  res.json({ 
    success: true, 
    id: req.user.id, 
    role: req.user.role, 
    phone: req.user.phone 
  });
});

module.exports = router;

