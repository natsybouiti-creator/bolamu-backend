// ============================================================
// BOLAMU — Routes Push Notifications (Sprint 7)
// ============================================================
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { subscribe, unsubscribe, sendToUser, sendToAll } = require('../services/push.service');

// Middleware pour vérifier le rôle admin
function adminOnly(req, res, next) {
    if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
        return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
    }
    next();
}

// ─── ROUTES AUTHENTIFIÉES ─────────────────────────────────────────────────────────────

// POST /api/v1/push/subscribe
// S'abonner aux notifications push
router.post('/subscribe', authMiddleware, async (req, res) => {
    try {
        const { endpoint, p256dh, auth, device_type } = req.body;
        const user_phone = req.user.phone;

        if (!endpoint || !p256dh || !auth) {
            return res.status(400).json({ 
                success: false, 
                message: 'endpoint, p256dh et auth sont requis.' 
            });
        }

        const result = await subscribe(user_phone, { 
            endpoint, 
            p256dh, 
            auth, 
            device_type: device_type || 'web' 
        });

        return res.json({
            success: true,
            message: 'Abonnement push enregistré avec succès.',
            data: result
        });
    } catch (error) {
        console.error('[PUSH SUBSCRIBE]', error.message);
        return res.status(500).json({ 
            success: false, 
            message: 'Erreur lors de l\'abonnement.' 
        });
    }
});

// DELETE /api/v1/push/unsubscribe
// Se désabonner des notifications push
router.delete('/unsubscribe', authMiddleware, async (req, res) => {
    try {
        const { endpoint } = req.body;
        const user_phone = req.user.phone;

        if (!endpoint) {
            return res.status(400).json({ 
                success: false, 
                message: 'endpoint est requis.' 
            });
        }

        const result = await unsubscribe(user_phone, endpoint);

        return res.json({
            success: true,
            message: 'Désabonnement effectué avec succès.',
            data: result
        });
    } catch (error) {
        console.error('[PUSH UNSUBSCRIBE]', error.message);
        return res.status(500).json({ 
            success: false, 
            message: 'Erreur lors du désabonnement.' 
        });
    }
});

// ─── ROUTES ADMIN ─────────────────────────────────────────────────────────────────

// POST /api/v1/push/test
// Envoyer une notification push de test
router.post('/test', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { user_phone, titre, message, type, data } = req.body;

        if (!user_phone) {
            return res.status(400).json({ 
                success: false, 
                message: 'user_phone est requis.' 
            });
        }

        const result = await sendToUser(user_phone, {
            titre: titre || 'Test Bolamu',
            message: message || 'Ceci est une notification de test.',
            type: type || 'info',
            data: data || {}
        });

        return res.json({
            success: true,
            message: 'Notification de test envoyée.',
            data: result
        });
    } catch (error) {
        console.error('[PUSH TEST]', error.message);
        return res.status(500).json({ 
            success: false, 
            message: 'Erreur lors de l\'envoi de la notification.' 
        });
    }
});

module.exports = router;
