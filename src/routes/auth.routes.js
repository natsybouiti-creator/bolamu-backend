const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { normalizePhone } = require('../utils/phone');
const { strictLimiter } = require('../middleware/rateLimiter');

const {
    requestOtp,
    verifyOtp,
    login,
    forgotPassword,
    registerPatient,
    registerDoctor,
    registerPharmacie,
    registerLaboratoire,
    refreshToken,
    logout
} = require('../controllers/auth.controller');

const JWT_SECRET = process.env.JWT_SECRET || 'bcbd5ea11381ab60f10bae67784495cc2b3ed3fbcbdf353d913d7d454ff33f35';
const ACCESS_TOKEN_EXPIRES = '15m';
const REFRESH_TOKEN_EXPIRES = '7d';
const ADMIN_ROLES = ['admin', 'content_admin'];

// ─── OTP & LOGIN ──────────────────────────────────────────────────────────────
router.post('/request-otp', strictLimiter, requestOtp);
router.post('/verify-otp', strictLimiter, verifyOtp);
router.post('/login', strictLimiter, login);
router.post('/forgot-password', strictLimiter, forgotPassword);

// ─── REGISTER ─────────────────────────────────────────────────────────────────
router.post('/register/patient',     registerPatient);
router.post('/register/doctor',      registerDoctor);
router.post('/register/pharmacie',   registerPharmacie);
router.post('/register/laboratoire', registerLaboratoire);

// ─── REFRESH TOKEN & LOGOUT ─────────────────────────────────────────────────────
router.post('/refresh', refreshToken);
router.post('/logout', logout);

// ─── MAGIC LINK ONBOARDING (première connexion automatique) ──────────────────
router.get('/onboarding/:token', async (req, res) => {
    const { token } = req.params;

    if (!token) {
        return res.status(401).json({ success: false, message: 'Lien invalide ou déjà utilisé' });
    }

    try {
        const result = await pool.query(
            `SELECT id, phone, role, full_name, first_login_done, onboarding_token_expires_at
             FROM users
             WHERE onboarding_token = $1`,
            [token]
        );

        if (!result.rows.length) {
            return res.status(401).json({ success: false, message: 'Lien invalide ou déjà utilisé' });
        }

        const user = result.rows[0];

        if (new Date(user.onboarding_token_expires_at) < new Date()) {
            return res.status(401).json({ success: false, message: 'Lien expiré. Contactez votre agent Bolamu.' });
        }

        // Génère un JWT normal (même logique que le login classique)
        const jwtToken = jwt.sign(
            { id: user.id, phone: user.phone, role: user.role },
            JWT_SECRET,
            { expiresIn: ACCESS_TOKEN_EXPIRES }
        );

        // Invalide le token onboarding (usage unique)
        await pool.query(
            `UPDATE users SET onboarding_token = NULL,
                onboarding_token_expires_at = NULL,
                first_login_done = TRUE
             WHERE phone = $1`,
            [user.phone]
        );

        // Audit log
        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('auth.onboarding_login', $1, 'users', $2, $3::jsonb)`,
            [user.phone, user.id, JSON.stringify({ role: user.role })]
        ).catch(() => {});

        return res.json({
            success: true,
            token: jwtToken,
            user: { phone: user.phone, role: user.role, full_name: user.full_name }
        });
    } catch (err) {
        console.error('[onboarding]', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ─── LOGIN ADMIN SÉCURISÉ ─────────────────────────────────────────────────────
router.post('/admin-login', async (req, res) => {
    const { phone, password } = req.body;

    if (!phone || !password) {
        return res.status(400).json({ success: false, message: 'Téléphone et mot de passe requis.' });
    }

    // Normalisation du numéro avec l'utilitaire existant
    const normalizedPhone = normalizePhone(phone);

    try {
        const result = await pool.query(
            `SELECT id, phone, full_name, role, is_active, banned, admin_password 
             FROM users 
             WHERE phone = $1 AND role IN ('admin', 'content_admin')`,
            [normalizedPhone]
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
                [normalizedPhone, user.id, JSON.stringify({ reason: 'wrong_password' })]
            ).catch(() => {});
            return res.status(401).json({ success: false, message: 'Mot de passe incorrect.' });
        }

        // Access token (15min)
        const accessToken = jwt.sign(
            { id: user.id, phone: user.phone, role: user.role },
            JWT_SECRET,
            { expiresIn: ACCESS_TOKEN_EXPIRES }
        );

        // Refresh token (7 jours)
        const refreshToken = crypto.randomBytes(64).toString('hex');
        const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 jours

        // Stocker le refresh token
        await pool.query(
            `INSERT INTO refresh_tokens (phone, token_hash, expires_at, is_revoked)
             VALUES ($1, $2, $3, FALSE)
             ON CONFLICT (phone) DO UPDATE SET token_hash = $2, expires_at = $3, is_revoked = FALSE`,
            [normalizedPhone, refreshTokenHash, expiresAt]
        ).catch(() => {}); // Ignorer si la table n'existe pas encore

        // Audit Log
        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) 
             VALUES ('admin.login_success', $1, 'users', $2, $3)`,
            [normalizedPhone, user.id, JSON.stringify({ role: user.role, timestamp: new Date().toISOString() })]
        ).catch(() => {});

        // Redirection selon le rôle
        const redirectUrl = user.role === 'content_admin'
            ? '/admin/content.html'
            : '/admin/dashboard.html';

        return res.json({
            success: true,
            accessToken,
            refreshToken,
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

// ─── POST /api/v1/auth/set-password-temp — usage interne uniquement ─────────────
router.post('/set-password-temp', async (req, res) => {
  const { phone, password } = req.body;
  const normalizedPhone = normalizePhone(phone);

  if (!phone || !password) {
    return res.status(400).json({ success: false, message: 'Téléphone et mot de passe requis.' });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      `UPDATE users SET password_hash = $1, temp_password_must_change = true WHERE phone = $2`,
      [hashed, normalizedPhone]
    );
    res.json({ success: true, message: 'Mot de passe configuré avec succès.' });
  } catch (err) {
    console.error('[set-password-temp]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

module.exports = router;