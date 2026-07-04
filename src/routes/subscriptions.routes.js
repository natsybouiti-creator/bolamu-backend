// ============================================================
// BOLAMU — Routes Abonnements (souscription patient)
// Schéma adapté : patient_phone + plan ENUM (essentiel|standard|premium)
// Mapping affichage uniquement : essentiel=MOTO, standard=NDEKO, premium=LIBOTA
// ============================================================
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middleware/auth.middleware');
const { normalizePhone } = require('../utils/phone');
const { sendAutoMessage } = require('../services/whatsapp-web.service');

const VALID_PLANS = ['essentiel', 'standard', 'premium'];
const VALID_OPERATORS = ['MTN', 'AIRTEL'];
const PLAN_LABEL = { essentiel: 'MOTO', standard: 'NDEKO', premium: 'LIBOTA' };

// Récupère le montant mensuel depuis platform_config (jamais hardcodé)
async function getPlanAmount(plan) {
    const r = await db.query(
        `SELECT config_value FROM platform_config WHERE config_key = $1`,
        [`price_${plan}`]
    );
    if (!r.rows.length) return null;
    return parseInt(r.rows[0].config_value, 10);
}

// ─── POST /initiate ───────────────────────────────────────────────────────────
router.post('/initiate', authMiddleware, async (req, res) => {
    const phone = normalizePhone(req.user?.phone || '');
    if (!phone) return res.status(401).json({ success: false, message: 'Non authentifié.' });

    const { plan, operator } = req.body;
    if (!VALID_PLANS.includes(plan)) {
        return res.status(400).json({ success: false, message: 'Plan invalide.' });
    }
    if (!VALID_OPERATORS.includes(operator)) {
        return res.status(400).json({ success: false, message: 'Opérateur invalide.' });
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        // Vérifier qu'il n'existe pas déjà un abonnement actif
        const existing = await client.query(
            `SELECT id FROM subscriptions
             WHERE patient_phone = $1 AND status = 'active' AND is_active = TRUE AND expires_at > NOW()`,
            [phone]
        );
        if (existing.rows.length) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Un abonnement actif existe déjà.' });
        }

        const amount = await getPlanAmount(plan);
        if (amount === null) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Tarif introuvable pour ce plan.' });
        }

        // expires_at est NOT NULL dans le schéma → placeholder, recalculé à la validation
        const inserted = await client.query(
            `INSERT INTO subscriptions
                (patient_phone, plan, amount_fcfa, operator, status, started_at, expires_at, is_active)
             VALUES ($1, $2, $3, $4, 'pending', NOW(), NOW() + INTERVAL '30 days', FALSE)
             RETURNING id`,
            [phone, plan, amount, operator]
        );

        await client.query('COMMIT');
        res.status(201).json({
            success: true,
            subscription_id: inserted.rows[0].id,
            plan,
            operator,
            amount_fcfa: amount
        });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('[subscriptions/initiate]', e.message);
        res.status(500).json({ success: false, message: 'Erreur lors de l\'initiation.' });
    } finally {
        client.release();
    }
});

// ─── POST /confirm ────────────────────────────────────────────────────────────
router.post('/confirm', authMiddleware, async (req, res) => {
    const phone = normalizePhone(req.user?.phone || '');
    if (!phone) return res.status(401).json({ success: false, message: 'Non authentifié.' });

    const { subscription_id, payment_reference } = req.body;
    if (!subscription_id || !payment_reference) {
        return res.status(400).json({ success: false, message: 'subscription_id et payment_reference requis.' });
    }

    try {
        const upd = await db.query(
            `UPDATE subscriptions
             SET payment_reference = $1, updated_at = NOW()
             WHERE id = $2 AND patient_phone = $3
             RETURNING id, plan, operator`,
            [payment_reference, subscription_id, phone]
        );

        if (!upd.rows.length) {
            return res.status(404).json({ success: false, message: 'Souscription introuvable.' });
        }

        const sub = upd.rows[0];

        // Audit log (insert-only)
        await db.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('subscription.confirm', $1, 'subscriptions', $2, $3::jsonb)`,
            [phone, sub.id, JSON.stringify({ plan: sub.plan, operator: sub.operator, payment_reference })]
        ).catch(() => {});

        // Notification WhatsApp admin (best-effort, non bloquant)
        try {
            const adminPhone = process.env.ADMIN_NOTIFY_PHONE || '+242060000099';
            await sendAutoMessage(adminPhone, 'bolamu_souscription_a_valider', [
                PLAN_LABEL[sub.plan] || sub.plan,
                sub.operator,
                payment_reference
            ]);
        } catch (_) { /* non bloquant */ }

        res.json({ success: true, message: 'Votre paiement est en cours de vérification' });
    } catch (e) {
        console.error('[subscriptions/confirm]', e.message);
        res.status(500).json({ success: false, message: 'Erreur lors de la confirmation.' });
    }
});

// ─── GET /me — abonnement courant du patient ──────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
    const phone = normalizePhone(req.user?.phone || '');
    if (!phone) return res.status(401).json({ success: false, message: 'Non authentifié.' });

    try {
        const r = await db.query(
            `SELECT id, plan, status, operator, amount_fcfa, next_billing_date, payment_reference
             FROM subscriptions
             WHERE patient_phone = $1 AND status IN ('active', 'pending')
             ORDER BY created_at DESC LIMIT 1`,
            [phone]
        );
        res.json({ success: true, subscription: r.rows[0] || null });
    } catch (e) {
        console.error('[subscriptions/me]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ─── PUT /:id/validate — activation par admin ─────────────────────────────────
router.put('/:id/validate', authMiddleware, async (req, res) => {
    if (!['admin', 'content_admin'].includes(req.user?.role)) {
        return res.status(403).json({ success: false, message: 'Accès réservé aux admins.' });
    }
    const adminPhone = normalizePhone(req.user?.phone || '');
    const { id } = req.params;

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const subRes = await client.query(
            `SELECT id, patient_phone, plan FROM subscriptions WHERE id = $1 FOR UPDATE`,
            [id]
        );
        if (!subRes.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Souscription introuvable.' });
        }
        const sub = subRes.rows[0];

        // Désactiver les anciens abonnements actifs du patient
        await client.query(
            `UPDATE subscriptions SET is_active = FALSE, status = 'expired'
             WHERE patient_phone = $1 AND is_active = TRUE AND id <> $2`,
            [sub.patient_phone, id]
        );

        // Activer l'abonnement courant
        await client.query(
            `UPDATE subscriptions
             SET status = 'active',
                 is_active = TRUE,
                 started_at = NOW(),
                 expires_at = DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
                 next_billing_date = (DATE_TRUNC('month', NOW()) + INTERVAL '1 month')::date,
                 validated_by = $1,
                 validated_at = NOW(),
                 updated_at = NOW()
             WHERE id = $2`,
            [adminPhone, id]
        );

        // Activer le compte patient
        await client.query(
            `UPDATE users SET is_active = TRUE WHERE phone = $1`,
            [sub.patient_phone]
        );

        // Audit log
        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('subscription.validate', $1, 'subscriptions', $2, $3::jsonb)`,
            [adminPhone, sub.id, JSON.stringify({ plan: sub.plan, patient_phone: sub.patient_phone })]
        ).catch(() => {});

        await client.query('COMMIT');

        // Notification WhatsApp patient (best-effort)
        try {
            await sendAutoMessage(sub.patient_phone, 'bolamu_abonnement_active', [
                PLAN_LABEL[sub.plan] || sub.plan
            ]);
        } catch (_) { /* non bloquant */ }

        res.json({ success: true });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('[subscriptions/validate]', e.message);
        res.status(500).json({ success: false, message: 'Erreur lors de la validation.' });
    } finally {
        client.release();
    }
});

module.exports = router;
