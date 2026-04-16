const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const {
    requestOtp,
    verifyOtp,
    login,
    registerPatient,
    registerDoctor,
    registerPharmacie,
    registerLaboratoire
} = require('../controllers/auth.controller');

const JWT_SECRET = process.env.JWT_SECRET || 'bolamu_cle_secrete_brazzaville_2026';
const ADMIN_ROLES = ['admin', 'content_admin'];

// ─── OTP & LOGIN ──────────────────────────────────────────────────────────────
router.post('/request-otp', requestOtp);
router.post('/verify-otp', verifyOtp);
router.post('/login', login);

// ─── REGISTER ─────────────────────────────────────────────────────────────────
router.post('/register/patient',     registerPatient);
router.post('/register/doctor',      registerDoctor);
router.post('/register/pharmacie',   registerPharmacie);
router.post('/register/laboratoire', registerLaboratoire);

// ─── LOGIN ADMIN SÉCURISÉ ─────────────────────────────────────────────────────
router.post('/admin-login', async (req, res) => {
    const { phone, password } = req.body;

    if (!phone || !password) {
        return res.status(400).json({ success: false, message: 'Téléphone et mot de passe requis.' });
    }

    try {
        const result = await pool.query(
            `SELECT id, phone, full_name, role, is_active, banned, admin_password 
             FROM users 
             WHERE phone = $1 AND role IN ('admin', 'content_admin')`,
            [phone]
        );

        if (!result.rows.length) {
            return res.status(401).json({ success: false, message: 'Accès refusé.' });
        }

        const user = result.rows[0];

        if (!user.is_active || user.banned) {
            return res.status(403).json({ success: false, message: 'Compte désactivé ou banni.' });
        }

        // Vérification bcrypt — compatible hash ET texte clair (rétrocompatible)
        let passwordOk = false;
        if (user.admin_password) {
            const isHashed = user.admin_password.startsWith('$2b$') || user.admin_password.startsWith('$2a$');
            if (isHashed) {
                passwordOk = await bcrypt.compare(password, user.admin_password);
            } else {
                passwordOk = user.admin_password === password;
            }
        }

        if (!passwordOk) {
            await pool.query(
                `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) 
                 VALUES ('admin.login_failed', $1, 'users', $2, $3)`,
                [phone, user.id, JSON.stringify({ reason: 'wrong_password' })]
            ).catch(() => {});
            return res.status(401).json({ success: false, message: 'Mot de passe incorrect.' });
        }

        // Génération du token
        const token = jwt.sign(
            { id: user.id, phone: user.phone, role: user.role }, 
            JWT_SECRET, 
            { expiresIn: '8h' }
        );

        // Audit Log
        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) 
             VALUES ('admin.login_success', $1, 'users', $2, $3)`,
            [phone, user.id, JSON.stringify({ role: user.role, timestamp: new Date().toISOString() })]
        ).catch(() => {});

        // Redirection selon le rôle
        const redirectUrl = user.role === 'content_admin'
            ? '/admin/content.html'
            : '/admin/dashboard.html';

        return res.json({ 
            success: true, 
            token, 
            phone: user.phone, 
            role: user.role, 
            full_name: user.full_name, 
            redirectUrl 
        });

    } catch (err) {
        console.error('[admin-login]', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ─── GET /api/v1/auth/me ──────────────────────────────────────────────────────
router.get('/me', authMiddleware, (req, res) => {
  res.json({ 
    success: true, 
    id: req.user.id, 
    role: req.user.role, 
    phone: req.user.phone 
  });
});

module.exports = router;