// ============================================================
// BOLAMU — Routes Notifications (Sprint 7)
// ============================================================
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middleware/auth.middleware');
const { subscribe, unsubscribe } = require('../services/push.service');
const { handleWebhook, verifyWebhook } = require('../services/whatsapp.service');

// ============================================================
// 1. PUSH SUBSCRIPTIONS
// ============================================================

// POST /api/v1/notifications/push/subscribe
// Enregistrer subscription push du device
router.post('/push/subscribe', authMiddleware, async (req, res) => {
    try {
        const { endpoint, p256dh, auth, device_type } = req.body;
        const user_phone = req.user.phone;

        if (!endpoint || !p256dh || !auth) {
            return res.status(400).json({ 
                success: false, 
                message: 'endpoint, p256dh et auth sont requis' 
            });
        }

        const result = await subscribe(user_phone, { endpoint, p256dh, auth, device_type });
        res.json(result);
    } catch (error) {
        console.error('[Push Subscribe] Erreur:', error.message);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// POST /api/v1/notifications/push/unsubscribe
// Désactiver subscription push
router.post('/push/unsubscribe', authMiddleware, async (req, res) => {
    try {
        const { endpoint } = req.body;
        const user_phone = req.user.phone;

        if (!endpoint) {
            return res.status(400).json({ 
                success: false, 
                message: 'endpoint est requis' 
            });
        }

        const result = await unsubscribe(user_phone, endpoint);
        res.json(result);
    } catch (error) {
        console.error('[Push Unsubscribe] Erreur:', error.message);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// ============================================================
// 2. NOTIFICATIONS
// ============================================================

// GET /api/v1/notifications
// Lister notifications du user connecté (paginé, 20/page)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const user_phone = req.user.phone;
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;

        const result = await db.query(`
            SELECT id, type, titre, message, data, canal, is_read, sent_at, read_at, created_at
            FROM notifications
            WHERE user_phone = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
        `, [user_phone, limit, offset]);

        const countResult = await db.query(`
            SELECT COUNT(*) as total
            FROM notifications
            WHERE user_phone = $1
        `, [user_phone]);

        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / limit);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error('[Notifications List] Erreur:', error.message);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// PATCH /api/v1/notifications/:id/read
// Marquer comme lue
router.patch('/:id/read', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const user_phone = req.user.phone;

        await db.query(`
            UPDATE notifications
            SET is_read = TRUE, read_at = NOW()
            WHERE id = $1 AND user_phone = $2
        `, [id, user_phone]);

        res.json({ success: true, message: 'Notification marquée comme lue' });
    } catch (error) {
        console.error('[Notification Read] Erreur:', error.message);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// PATCH /api/v1/notifications/read-all
// Marquer toutes comme lues
router.patch('/read-all', authMiddleware, async (req, res) => {
    try {
        const user_phone = req.user.phone;

        await db.query(`
            UPDATE notifications
            SET is_read = TRUE, read_at = NOW()
            WHERE user_phone = $1 AND is_read = FALSE
        `, [user_phone]);

        res.json({ success: true, message: 'Toutes les notifications marquées comme lues' });
    } catch (error) {
        console.error('[Notifications Read All] Erreur:', error.message);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// GET /api/v1/notifications/unread-count
// Nombre de notifications non lues (badge)
router.get('/unread-count', authMiddleware, async (req, res) => {
    try {
        const user_phone = req.user.phone;

        const result = await db.query(`
            SELECT COUNT(*) as count
            FROM notifications
            WHERE user_phone = $1 AND is_read = FALSE
        `, [user_phone]);

        const count = parseInt(result.rows[0].count);

        res.json({ success: true, count });
    } catch (error) {
        console.error('[Unread Count] Erreur:', error.message);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// ============================================================
// 3. WEBHOOKS
// ============================================================

// GET /api/v1/webhooks/whatsapp
// Vérification webhook WhatsApp (GET pour verification token)
router.get('/webhooks/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const result = verifyWebhook(mode, token, challenge);

    if (result) {
        res.status(200).send(result);
    } else {
        res.status(403).send('Forbidden');
    }
});

// POST /api/v1/webhooks/whatsapp
// Webhook WhatsApp (POST pour messages)
router.post('/webhooks/whatsapp', async (req, res) => {
    try {
        await handleWebhook(req.body);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('[WhatsApp Webhook] Erreur:', error.message);
        res.status(200).json({ success: true }); // Toujours 200 pour éviter les retentatives
    }
});

// ============================================================
// 4. VAPID PUBLIC KEY
// ============================================================

// GET /api/v1/vapid-public-key
// Retourner VAPID_PUBLIC_KEY pour le frontend
router.get('/vapid-public-key', (req, res) => {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    
    if (!vapidPublicKey) {
        return res.status(500).json({ 
            success: false, 
            message: 'VAPID_PUBLIC_KEY non configuré' 
        });
    }

    res.json({ 
        success: true, 
        vapidPublicKey 
    });
});

module.exports = router;
