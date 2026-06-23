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
const { sendWhatsAppTemplate } = require('../services/whatsapp.service');
const { buildWameLink } = require('../services/wame.service');
const logger = require('../config/logger');

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
router.get('/stats', requireAnimateur, async (req, res) => {
    try {
        const phone = req.user.phone;

        const result = await pool.query(
            `SELECT
               (SELECT COUNT(*) FROM elonga_events
                WHERE organizer_phone = $1) AS total_events,
               (SELECT COUNT(*) FROM elonga_events
                WHERE organizer_phone = $1 AND status = 'published') AS events_actifs,
               (SELECT COUNT(*) FROM elonga_registrations er
                JOIN elonga_events ee ON er.event_id = ee.id
                WHERE ee.organizer_phone = $1) AS total_inscriptions,
               (SELECT COUNT(*) FROM elonga_registrations er
                JOIN elonga_events ee ON er.event_id = ee.id
                WHERE ee.organizer_phone = $1 AND er.checkin_at IS NOT NULL) AS total_checkins,
               (SELECT COUNT(*) FROM clubs WHERE animateur_phone = $1) AS total_clubs,
               (SELECT COUNT(*) FROM club_members cm
                JOIN clubs c ON cm.club_id = c.id
                WHERE c.animateur_phone = $1 AND cm.is_active = true) AS total_membres`,
            [phone]
        );

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        logger.error('[ANIMATEUR STATS]', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── GET /events ──────────────────────────────────────────────────────────────
router.get('/events', requireAnimateur, async (req, res) => {
    try {
        const phone = req.user.phone;
        const { limit = 20, offset = 0 } = req.query;

        const result = await pool.query(
            `SELECT
               ee.id, ee.title, ee.description, ee.pillar,
               ee.location_name, ee.city,
               ee.starts_at, ee.ends_at,
               ee.max_participants, ee.zora_reward, ee.status,
               ee.proof_class,
               COUNT(er.id) AS inscriptions,
               COUNT(er.checkin_at) AS checkins
             FROM elonga_events ee
             LEFT JOIN elonga_registrations er ON ee.id = er.event_id
             WHERE ee.organizer_phone = $1
             GROUP BY ee.id
             ORDER BY ee.starts_at DESC
             LIMIT $2 OFFSET $3`,
            [phone, parseInt(limit), parseInt(offset)]
        );

        res.json({ success: true, data: result.rows });
    } catch (err) {
        logger.error('[ANIMATEUR EVENTS GET]', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── POST /events ─────────────────────────────────────────────────────────────
router.post('/events', requireAnimateur, async (req, res) => {
    try {
        const phone = req.user.phone;
        const {
            title, description, pillar,
            location_name, location_address,
            latitude, longitude, city,
            starts_at, ends_at,
            max_participants, zora_reward = 50
        } = req.body;

        if (!title || !pillar || !location_name || !location_address || !city || !starts_at || !ends_at) {
            return res.status(400).json({ success: false, message: 'Champs obligatoires manquants' });
        }

        const result = await pool.query(
            `INSERT INTO elonga_events
               (title, description, pillar, location_name, location_address,
                latitude, longitude, city, starts_at, ends_at,
                max_participants, zora_reward, proof_class, status, organizer_phone)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'ground_truth','published',$13)
             RETURNING id, title, starts_at, status`,
            [
                title, description || null, pillar, location_name, location_address,
                latitude || null, longitude || null, city, starts_at, ends_at,
                max_participants || null, zora_reward, phone
            ]
        );

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        logger.error('[ANIMATEUR EVENTS POST]', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── GET /clubs ───────────────────────────────────────────────────────────────
router.get('/clubs', requireAnimateur, async (req, res) => {
    try {
        const phone = req.user.phone;

        const result = await pool.query(
            `SELECT
               c.id, c.name, c.description, c.category,
               c.max_members, c.is_active, c.created_at,
               COUNT(cm.id) FILTER (WHERE cm.is_active = true) AS membres_actifs
             FROM clubs c
             LEFT JOIN club_members cm ON c.id = cm.club_id
             WHERE c.animateur_phone = $1
             GROUP BY c.id
             ORDER BY c.created_at DESC`,
            [phone]
        );

        res.json({ success: true, data: result.rows });
    } catch (err) {
        logger.error('[ANIMATEUR CLUBS GET]', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── GET /events/:id/registrations ───────────────────────────────────────────────
router.get('/events/:id/registrations', requireAnimateur, async (req, res) => {
    try {
        const animateurPhone = req.user.phone;
        const eventId = parseInt(req.params.id);

        // Vérifier que l'événement appartient bien à cet animateur
        const eventCheck = await pool.query(
            `SELECT id, title FROM elonga_events WHERE id = $1 AND organizer_phone = $2`,
            [eventId, animateurPhone]
        );

        if (!eventCheck.rows.length) {
            return res.status(403).json({ success: false, message: 'Événement introuvable ou accès non autorisé' });
        }

        const result = await pool.query(
            `SELECT
               er.id, er.phone, er.registered_at, er.status, er.checkin_at, er.zora_awarded,
               u.full_name, u.first_name, u.last_name, u.avatar_url
             FROM elonga_registrations er
             LEFT JOIN users u ON er.phone = u.phone
             WHERE er.event_id = $1
             ORDER BY er.registered_at ASC`,
            [eventId]
        );

        res.json({ success: true, data: result.rows });
    } catch (err) {
        logger.error('[ANIMATEUR EVENT REGISTRATIONS]', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── GET /checkins/today ────────────────────────────────────────────────────────
router.get('/checkins/today', requireAnimateur, async (req, res) => {
    try {
        const phone = req.user.phone;

        const result = await pool.query(
            `SELECT
               er.id, er.phone, er.checkin_at, er.zora_awarded,
               ee.id AS event_id, ee.title AS event_title,
               u.full_name, u.first_name, u.last_name
             FROM elonga_registrations er
             JOIN elonga_events ee ON er.event_id = ee.id
             LEFT JOIN users u ON er.phone = u.phone
             WHERE ee.organizer_phone = $1
               AND er.status = 'checked_in'
               AND DATE(er.checkin_at) = CURRENT_DATE
             ORDER BY er.checkin_at DESC`,
            [phone]
        );

        res.json({ success: true, data: result.rows });
    } catch (err) {
        logger.error('[ANIMATEUR CHECKINS TODAY]', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── POST /clubs/:id/notify ───────────────────────────────────────────────────
router.post('/clubs/:id/notify', requireAnimateur, async (req, res) => {
    try {
        const animateurPhone = req.user.phone;
        const clubId = parseInt(req.params.id);
        const { message, template_name = 'bolamu_club_notification', template_params = [] } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, message: 'Message requis' });
        }

        // Vérifier que ce club appartient bien à cet animateur
        const clubCheck = await pool.query(
            `SELECT id, name FROM clubs WHERE id = $1 AND animateur_phone = $2`,
            [clubId, animateurPhone]
        );

        if (!clubCheck.rows.length) {
            return res.status(403).json({ success: false, message: 'Club introuvable ou accès non autorisé' });
        }

        const club = clubCheck.rows[0];

        // Récupérer les membres actifs du club avec leur téléphone
        const members = await pool.query(
            `SELECT cm.patient_phone
             FROM club_members cm
             WHERE cm.club_id = $1 AND cm.is_active = true`,
            [clubId]
        );

        if (!members.rows.length) {
            return res.json({ success: true, data: { sent: 0, failed: 0, message: 'Aucun membre actif dans ce club' } });
        }

        let sent = 0;
        let failed = 0;

        for (const member of members.rows) {
            const recipientPhone = normalizePhone(member.patient_phone);
            const params = template_params.length ? template_params : [club.name, message];

            try {
                const ok = await sendWhatsAppTemplate(recipientPhone, template_name, params);

                await pool.query(
                    `INSERT INTO whatsapp_notifications
                       (recipient_phone, template_name, template_params, status, sent_at)
                     VALUES ($1, $2, $3::jsonb, $4, $5)`,
                    [
                        recipientPhone,
                        template_name,
                        JSON.stringify({ params, club_id: clubId, message }),
                        ok ? 'sent' : 'failed',
                        ok ? new Date() : null
                    ]
                );

                if (ok) {
                    sent++;
                } else {
                    // Fallback wame.service
                    buildWameLink(recipientPhone, 'rdv_pris', { message });
                    failed++;
                }
            } catch (sendErr) {
                logger.error('[ANIMATEUR NOTIFY]', sendErr.message);
                await pool.query(
                    `INSERT INTO whatsapp_notifications
                       (recipient_phone, template_name, template_params, status, sent_at)
                     VALUES ($1, $2, $3::jsonb, 'failed', NULL)`,
                    [recipientPhone, template_name, JSON.stringify({ params, club_id: clubId })]
                );
                failed++;
            }
        }

        res.json({ success: true, data: { sent, failed, total: members.rows.length } });
    } catch (err) {
        logger.error('[ANIMATEUR CLUBS NOTIFY]', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
