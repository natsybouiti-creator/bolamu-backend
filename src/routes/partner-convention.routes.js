const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const pool = require('../config/db');
const { sendBolamuSms } = require('../services/sms.service');
const { sendWhatsAppTemplate } = require('../services/whatsapp.service');
const { normalizePhone } = require('../utils/phone');
const {
    createConvention,
    activateConvention,
    suspendConvention,
    terminateConvention,
    listConventions
} = require('../controllers/partner-convention.controller');

// Middleware admin only
function adminOnly(req, res, next) {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
    }
    next();
}

// Middleware partner only
function partnerOnly(req, res, next) {
    if (!['doctor', 'pharmacy', 'laboratory'].includes(req.user?.role)) {
        return res.status(403).json({ success: false, message: 'Accès réservé aux partenaires.' });
    }
    next();
}

// ─── ROUTES CONVENTIONS ───────────────────────────────────────────────────────

// Créer une convention
router.post('/', authMiddleware, adminOnly, createConvention);

// Lister les conventions
router.get('/', authMiddleware, adminOnly, listConventions);

// Activer une convention
router.patch('/:id/activate', authMiddleware, adminOnly, activateConvention);

// Suspendre une convention
router.patch('/:id/suspend', authMiddleware, adminOnly, suspendConvention);

// Résilier une convention
router.patch('/:id/terminate', authMiddleware, adminOnly, terminateConvention);

// ─── ROUTES SECRÉTAIRES (Sprint 8) ─────────────────────────────────────────────

// POST /api/v1/partner/secretaires
// Créer compte secrétaire (partenaire uniquement)
router.post('/secretaires', authMiddleware, partnerOnly, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { phone, nom, prenom, partenaire_type } = req.body;
        const partenaire_phone = req.user.phone;

        // Vérifier max 3 secrétaires actifs
        const countResult = await client.query(`
            SELECT COUNT(*) as count FROM secretaires 
            WHERE partenaire_phone = $1 AND is_active = TRUE
        `, [partenaire_phone]);

        if (parseInt(countResult.rows[0].count) >= 3) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Maximum 3 secrétaires actifs atteint' });
        }

        // Générer mot de passe temporaire
        const crypto = require('crypto');
        const tempPassword = crypto.randomBytes(8).toString('hex');

        // INSERT users (role='secretaire')
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        await client.query(`
            INSERT INTO users (phone, password_hash, role, full_name, is_active, created_at)
            VALUES ($1, $2, 'secretaire', $3, TRUE, NOW())
        `, [phone, hashedPassword, `${prenom} ${nom}`]);

        // INSERT secretaires
        await client.query(`
            INSERT INTO secretaires (phone, partenaire_phone, partenaire_type, nom, prenom, is_active, created_at)
            VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
        `, [phone, partenaire_phone, partenaire_type, nom, prenom]);

        // Audit log
        await client.query(`
            INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
            VALUES ('secretaire_cree', $1, 'secretaires', $2, $3)
        `, [partenaire_phone, phone, JSON.stringify({ nom, prenom })]);

        await client.query('COMMIT');

        // SMS bienvenue au secrétaire
        try {
            const normalizedPhone = normalizePhone(phone);
            await sendWhatsAppTemplate(normalizedPhone, 'bolamu_secretaire_bienvenue', [tempPassword]);
            // TODO: supprimer sendBolamuSms après validation WhatsApp
            // await sendBolamuSms(phone, `Bolamu: Bienvenue! Mot de passe temp: ${tempPassword}. Changez-le dès connexion.`);
        } catch (whatsappError) {
            console.warn('[WhatsApp] Envoi mot de passe échoué (non bloquant)', { phone: normalizedPhone || phone, error: whatsappError.message });
        }

        res.json({ success: true, message: 'Secrétaire créé avec succès' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Secretaire] Erreur création:', error.message);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    } finally {
        client.release();
    }
});

// GET /api/v1/partner/secretaires
// Lister secrétaires du partenaire connecté
router.get('/secretaires', authMiddleware, partnerOnly, async (req, res) => {
    try {
        const partenaire_phone = req.user.phone;

        const result = await pool.query(`
            SELECT s.phone, s.nom, s.prenom, s.partenaire_type, s.is_active, s.created_at,
                   u.full_name
            FROM secretaires s
            JOIN users u ON u.phone = s.phone
            WHERE s.partenaire_phone = $1
            ORDER BY s.created_at DESC
        `, [partenaire_phone]);

        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('[Secretaire] Erreur liste:', error.message);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// PATCH /api/v1/partner/secretaires/:phone/toggle
// Activer/désactiver secrétaire (soft)
router.patch('/secretaires/:phone/toggle', authMiddleware, partnerOnly, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { phone } = req.params;
        const partenaire_phone = req.user.phone;

        // Toggle is_active
        const result = await client.query(`
            UPDATE secretaires
            SET is_active = NOT is_active
            WHERE phone = $1 AND partenaire_phone = $2
            RETURNING is_active
        `, [phone, partenaire_phone]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Secrétaire introuvable' });
        }

        const newStatus = result.rows[0].is_active;

        // Soft delete sur users aussi
        await client.query(`
            UPDATE users SET is_active = $1 WHERE phone = $2
        `, [newStatus, phone]);

        // Audit log
        await client.query(`
            INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
            VALUES ($1, $2, 'secretaires', $3, $4)
        `, [newStatus ? 'secretaire_active' : 'secretaire_desactive', partenaire_phone, phone, JSON.stringify({ new_status: newStatus })]);

        await client.query('COMMIT');

        // SMS notification
        try {
            if (newStatus) {
                await sendWhatsAppTemplate(phone, 'bolamu_secretaire_reactive', []);
            } else {
                await sendWhatsAppTemplate(phone, 'bolamu_secretaire_desactive', []);
            }
            // TODO: supprimer sendBolamuSms après validation WhatsApp
            // const message = newStatus ? 'Bolamu: Compte réactivé. Connectez-vous maintenant.' : 'Bolamu: Compte désactivé. Contactez votre partenaire.';
            // await sendBolamuSms(phone, message);
        } catch (smsErr) {
            console.error('[Secretaire] Erreur WhatsApp:', smsErr.message);
        }

        res.json({ success: true, message: `Secrétaire ${newStatus ? 'activé' : 'désactivé'}` });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Secretaire] Erreur toggle:', error.message);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    } finally {
        client.release();
    }
});

module.exports = router;
