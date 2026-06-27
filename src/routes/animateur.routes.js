// ============================================================
// BOLAMU — Routes Animateur (Sprint 3)
// ============================================================
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { normalizePhone } = require('../utils/phone');
const authMiddleware = require('../middleware/auth.middleware');
const { 
  getStats, 
  getMyEvents, 
  createElongaEvent, 
  getMyClubs, 
  getTodayCheckins, 
  checkinPatient, 
  notifyClub,
  getEventRegistrations 
} = require('../controllers/animateur.controller');
const logger = require('../config/logger');
const { upload, uploadEvent } = require('../middleware/uploadEvent');

if (!process.env.JWT_SECRET) {
    throw new Error('[FATAL] JWT_SECRET non défini. Configurez cette variable dans Render.');
}
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware inline — accès animateur uniquement
const requireAnimateur = [authMiddleware, (req, res, next) => {
    if (!req.user || req.user.role !== 'animateur') {
        return res.status(403).json({ success: false, message: 'Accès réservé aux animateurs Bolamu' });
    }
    next();
}];

// ─── POST /login ──────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const rawPhone = req.body.phone;
        const { password } = req.body;

        if (!rawPhone || !password) {
            return res.status(400).json({ success: false, message: 'Numéro et mot de passe requis' });
        }

        const phone = normalizePhone(rawPhone);
        const result = await pool.query(
            `SELECT id, full_name, phone, password_hash, role, is_active
             FROM users
             WHERE phone = $1 AND role = 'animateur'`,
            [phone]
        );

        if (!result.rows.length) {
            return res.status(401).json({ success: false, message: 'Compte animateur introuvable' });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(403).json({ success: false, message: 'Compte inactif — contactez le support Bolamu' });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ success: false, message: 'Mot de passe incorrect' });
        }

        const token = jwt.sign(
            { id: user.id, phone: user.phone, role: user.role, is_active: true },
            JWT_SECRET,
            { expiresIn: '12h' }
        );

        res.json({
            success: true,
            token,
            animateur: { id: user.id, full_name: user.full_name, phone: user.phone }
        });
    } catch (err) {
        logger.error('[ANIMATEUR LOGIN]', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── GET /stats ───────────────────────────────────────────────────────────────
router.get('/stats', requireAnimateur, getStats);

// ─── GET /events ──────────────────────────────────────────────────────────────
router.get('/events', requireAnimateur, getMyEvents);

// ─── POST /events ─────────────────────────────────────────────────────────────
router.post('/events', requireAnimateur, upload.single('cover'), uploadEvent, createElongaEvent);

// ─── GET /clubs ───────────────────────────────────────────────────────────────
router.get('/clubs', requireAnimateur, getMyClubs);

// ─── GET /events/:id/registrations ───────────────────────────────────────────────
router.get('/events/:id/registrations', requireAnimateur, getEventRegistrations);

// ─── GET /checkins/today ────────────────────────────────────────────────────────
router.get('/checkins/today', requireAnimateur, getTodayCheckins);

// ─── POST /events/:id/checkin ────────────────────────────────────────────────────
router.post('/events/:id/checkin', requireAnimateur, checkinPatient);

// ─── POST /clubs/:id/notify ───────────────────────────────────────────────────
router.post('/clubs/:id/notify', requireAnimateur, notifyClub);

module.exports = router;
