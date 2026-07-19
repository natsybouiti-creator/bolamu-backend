const express = require('express');
const router = express.Router();
const db = require('../config/db');
const crypto = require('crypto');
const logger = require('../config/logger');
const validateMtnWebhook = require('../middleware/validateMtnWebhook');
const { webhookLimiter } = require('../middleware/rateLimiter');
const { normalizePhone } = require('../utils/phone');

const authMiddleware = require('../middleware/auth.middleware');

// ─── CONFIG MOMO ─────────────────────────────────────────────────────────────
const MOMO_BASE_URL = 'https://sandbox.momodeveloper.mtn.com';
const SUBSCRIPTION_KEY = process.env.MOMO_SUBSCRIPTION_KEY;
const API_USER = process.env.MOMO_API_USER;
const API_KEY = process.env.MOMO_API_KEY;

// ─── HELPER : token OAuth2 ────────────────────────────────────────────────────
async function getMoMoToken() {
    const credentials = Buffer.from(`${API_USER}:${API_KEY}`).toString('base64');

    console.log('[MoMo] Génération token...');

    const res = await fetch(`${MOMO_BASE_URL}/collection/token/`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY
        }
    });

    const text = await res.text();

    if (!res.ok) {
        console.error('[MoMo] Token error:', res.status, text);
        throw new Error(`Token error ${res.status}`);
    }

    const data = JSON.parse(text);

    console.log('[MoMo] Token généré ✅');

    return data.access_token;
}

// ─── HELPER : traiter paiement réussi ─────────────────────────────────────────
async function handlePaymentSuccess(phone, referenceId) {
    const client = await db.connect();
    try {
        await client.query('BEGIN');

        // Verrou pessimiste sur le patient pour éviter les race conditions
        const userLock = await client.query(
            'SELECT phone FROM users WHERE phone = $1 FOR UPDATE',
            [phone]
        );
        if (!userLock.rows.length) {
            await client.query('ROLLBACK');
            console.error(`[MoMo] Patient introuvable : ${phone}`);
            return;
        }

        const payRes = await client.query(
            'SELECT * FROM payments WHERE reference = $1',
            [referenceId]
        );
        if (!payRes.rows.length) {
            await client.query('ROLLBACK');
            return;
        }
        const payment = payRes.rows[0];
        if (payment.status === 'success') {
            await client.query('ROLLBACK');
            return;
        }

        // 1. Mettre à jour le statut du paiement
        await client.query(
            `UPDATE payments SET status = 'success', updated_at = NOW() WHERE reference = $1`,
            [referenceId]
        );

        // 2. Désactiver les anciens abonnements actifs
        await client.query(
            `UPDATE subscriptions SET is_active = FALSE, status = 'expired'
             WHERE patient_phone = $1 AND is_active = TRUE`,
            [phone]
        );

        // 3. Créer le nouvel abonnement dans subscriptions
        await client.query(
            `INSERT INTO subscriptions
                (patient_phone, plan, amount_fcfa, status, started_at, expires_at, is_active, payment_reference)
             VALUES ($1, $2, $3, 'active', NOW(), NOW() + INTERVAL '30 days', TRUE, $4)`,
            [phone, payment.plan, payment.amount_fcfa, referenceId]
        );

        // 4. Audit log
        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('payment.success', $1, 'subscriptions', $2, $3::jsonb)`,
            [phone, referenceId, JSON.stringify({
                plan: payment.plan,
                amount_fcfa: payment.amount_fcfa,
                operator: 'mtn'
            })]
        ).catch(() => {});

        await client.query('COMMIT');
        logger.info('[MoMo] Abonnement activé', { plan: payment.plan });
    } catch(e) {
        await client.query('ROLLBACK');
        console.error('handlePaymentSuccess error:', e.message);
        
        // Audit log en cas d'erreur
        try {
            await db.query(
                `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
                 VALUES ('payment.error', $1, 'payments', $2, $3::jsonb)`,
                [phone, referenceId, JSON.stringify({ error: e.message, operator: 'mtn' })]
            );
        } catch (auditErr) {
            console.error('Audit log error:', auditErr.message);
        }
    } finally {
        client.release();
    }
}

// ─── POST /request ────────────────────────────────────────────────────────────
router.post('/request', authMiddleware, async (req, res) => {
    try {
        const phone = normalizePhone(req.user?.phone);
        if (!phone) return res.status(401).json({ success: false, message: 'Non authentifié.' });

        const { amount, plan } = req.body;
        if (!amount || !plan) {
            return res.status(400).json({ success: false, message: 'Montant et plan requis.' });
        }

        // Validation du montant contre platform_config
        const configRes = await db.query(
            `SELECT config_value FROM platform_config WHERE config_key = $1`,
            [`price_${plan}`]
        );
        if (!configRes.rows.length) {
            return res.status(400).json({ success: false, message: 'Plan invalide.' });
        }
        const expectedAmount = parseInt(configRes.rows[0].config_value);
        if (parseInt(amount) !== expectedAmount) {
            return res.status(400).json({
                success: false,
                message: `Montant incorrect. Attendu : ${expectedAmount} FCFA.` 
            });
        }

        // INSERT INTO subscriptions (sans appel API externe)
        const insertRes = await db.query(
            `INSERT INTO subscriptions (patient_phone, plan, amount_fcfa, operator, status, is_active, expires_at, created_at)
             VALUES ($1, $2, $3, 'MTN', 'pending', FALSE, NOW() + INTERVAL '30 days', NOW())
             RETURNING id`,
            [phone, plan, amount]
        );

        const referenceId = insertRes.rows[0].id.toString();

        console.log('[MoMo] ✅ Paiement enregistré en base (status=pending)');

        res.json({
            success: true,
            message: 'Demande de paiement enregistrée',
            reference_id: referenceId
        });

    } catch(e) {
        console.error('[MoMo] request error:', e.message);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ─── GET /status/:referenceId ─────────────────────────────────────────────────
router.get('/status/:referenceId', authMiddleware, async (req, res) => {
    try {
        const { referenceId } = req.params;
        const phone = req.user?.phone;
        const token = await getMoMoToken();

        const momoRes = await fetch(`${MOMO_BASE_URL}/collection/v1_0/requesttopay/${referenceId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Target-Environment': 'sandbox',
                'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY
            }
        });

        const data = await momoRes.json();

        console.log('[MoMo] Status:', data.status);

        if (data.status === 'SUCCESSFUL') {
            await handlePaymentSuccess(phone, referenceId);
        } else if (data.status === 'FAILED') {
            await db.query(
                `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE reference = $1`,
                [referenceId]
            );
            await db.query(
                `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
                 VALUES ('payment.failed', $1, 'payments', $2, $3::jsonb)`,
                [phone, referenceId, JSON.stringify({ operator: 'mtn' })]
            ).catch(() => {});
        }

        res.json({ success: true, status: data.status });

    } catch(e) {
        console.error('[MoMo] status error:', e.message);
        res.status(500).json({ success: false });
    }
});

// ─── POST /webhook ───────────────────────────────────────────────────────────
// Endpoint webhook MTN MoMo avec validation HMAC-SHA256
// Ce endpoint reçoit les notifications asynchrones de MTN MoMo
router.post('/webhook', webhookLimiter, validateMtnWebhook, async (req, res) => {
    try {
        // Parser le body (il est en buffer brut à cause de express.raw())
        const bodyString = req.body.toString('utf8');
        const webhookData = JSON.parse(bodyString);

        console.log('[MoMo Webhook] Données reçues:', JSON.stringify(webhookData));

        const { externalId, status } = webhookData;

        if (!externalId || !status) {
            console.error('[MoMo Webhook] Données invalides');
            return res.status(400).json({ success: false, message: 'Données invalides' });
        }

        // Récupérer le paiement correspondant
        const payRes = await db.query(
            'SELECT * FROM payments WHERE reference = $1',
            [externalId]
        );

        if (!payRes.rows.length) {
            console.error('[MoMo Webhook] Paiement introuvable:', externalId);
            return res.status(404).json({ success: false, message: 'Paiement introuvable' });
        }

        const payment = payRes.rows[0];

        if (status === 'SUCCESSFUL') {
            await handlePaymentSuccess(payment.patient_phone, externalId);
        } else if (status === 'FAILED') {
            await db.query(
                `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE reference = $1`,
                [externalId]
            );
            await db.query(
                `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
                 VALUES ('payment.failed', $1, 'payments', $2, $3::jsonb)`,
                [payment.patient_phone, externalId, JSON.stringify({ operator: 'mtn', source: 'webhook' })]
            ).catch(() => {});
        }

        res.json({ success: true, message: 'Webhook traité' });

    } catch(e) {
        console.error('[MoMo Webhook] Erreur:', e.message);
        res.status(500).json({ success: false, message: 'Erreur traitement webhook' });
    }
});

// ─── POST /simulate-success (tests uniquement — désactivé en production) ──────
router.post('/simulate-success', authMiddleware, async (req, res) => {
    // Protection : secret requis en production
    const testSecret = process.env.TEST_SECRET;
    if (process.env.NODE_ENV === 'production') {
        const headerSecret = req.headers['x-test-secret'];
        if (!testSecret || headerSecret !== testSecret) {
            return res.status(403).json({
                success: false,
                message: 'Endpoint réservé aux tests.'
            });
        }
    }
    const { subscription_id } = req.body;
    if (!subscription_id) {
        return res.status(400).json({ success: false, message: 'subscription_id requis.' });
    }
    try {
        const r = await db.query(
            `UPDATE subscriptions
             SET status = 'active', is_active = TRUE, started_at = NOW(),
                 expires_at = DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
                 next_billing_date = (DATE_TRUNC('month', NOW()) + INTERVAL '1 month')::date,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING patient_phone`,
            [subscription_id]
        );
        if (!r.rows.length) {
            return res.status(404).json({ success: false, message: 'Souscription introuvable.' });
        }
        // Désactiver les anciennes lignes actives du patient (même logique que
        // PUT /subscriptions/:id/validate) — une ligne zombie expirée mais
        // is_active=TRUE ferait désactiver le compte par le cron abonnement.
        await db.query(
            `UPDATE subscriptions SET is_active = FALSE, status = 'expired'
             WHERE patient_phone = $1 AND is_active = TRUE AND id <> $2`,
            [r.rows[0].patient_phone, subscription_id]
        );
        await db.query(`UPDATE users SET is_active = TRUE WHERE phone = $1`, [r.rows[0].patient_phone]);
        res.json({ success: true });
    } catch (e) {
        console.error('[momo/simulate-success]', e.message);
        res.status(500).json({ success: false });
    }
});

module.exports = router;