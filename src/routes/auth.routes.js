const express = require('express');
const router = express.Router();

const {
    requestOtp,
    verifyOtp,
    login
} = require('../controllers/auth.controller');

router.post('/request-otp', requestOtp);
router.post('/verify-otp', verifyOtp);
router.post('/login', login);

// ─── LOGIN ADMIN SÉCURISÉ ─────────────────────────────────────────────────────
const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'bolamu_cle_secrete_brazzaville_2026';

router.post('/admin-login', async (req, res) => {
    const { phone, password } = req.body;

    if (!phone || !password) {
        return res.status(400).json({ success: false, message: 'Téléphone et mot de passe requis.' });
    }

    try {
        // Vérifier que le compte existe et est admin
        const result = await pool.query(
            `SELECT id, phone, full_name, role, is_active, banned, admin_password
             FROM users WHERE phone = $1 AND role = 'admin'`,
            [phone]
        );

        if (!result.rows.length) {
            // Log tentative échouée
            await pool.query(
                `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
                 VALUES ('admin.login_failed', $1, 'users', NULL, $2)`,
                [phone, JSON.stringify({ reason: 'phone_not_found' })]
            ).catch(() => {});
            return res.status(401).json({ success: false, message: 'Accès refusé.' });
        }

        const user = result.rows[0];

        if (!user.is_active || user.banned) {
            return res.status(403).json({ success: false, message: 'Compte désactivé.' });
        }

        // Vérifier le mot de passe
        if (!user.admin_password || user.admin_password !== password) {
            await pool.query(
                `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
                 VALUES ('admin.login_failed', $1, 'users', $2, $3)`,
                [phone, user.id, JSON.stringify({ reason: 'wrong_password' })]
            ).catch(() => {});
            return res.status(401).json({ success: false, message: 'Mot de passe incorrect.' });
        }

        // Générer le token JWT
        const token = jwt.sign(
            { id: user.id, phone: user.phone, role: 'admin' },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        // Log connexion réussie
        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('admin.login_success', $1, 'users', $2, $3)`,
            [phone, user.id, JSON.stringify({ timestamp: new Date().toISOString() })]
        ).catch(() => {});

        return res.json({
            success: true,
            token,
            phone: user.phone,
            role: 'admin',
            full_name: user.full_name,
            redirectUrl: '/admin/dashboard.html'
        });

    } catch (err) {
        console.error('[admin-login]', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;