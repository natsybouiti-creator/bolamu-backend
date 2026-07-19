// ============================================================
// BOLAMU — Routes Airtel Money
// ============================================================
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const crypto = require('crypto');
const authMiddleware = require('../middleware/auth.middleware');
const { webhookLimiter } = require('../middleware/rateLimiter');
const validateAirtelWebhook = require('../middleware/validateAirtelWebhook');
const idempotencyMiddleware = require('../middleware/idempotency');

// ─── CONFIG AIRTEL ───────────────────────────────────────────────────────────
const AIRTEL_BASE_URL = process.env.AIRTEL_BASE_URL || 'https://openapi.airtel.africa';
const AIRTEL_CLIENT_ID = process.env.AIRTEL_CLIENT_ID;
const AIRTEL_CLIENT_SECRET = process.env.AIRTEL_CLIENT_SECRET;

// ─── HELPER : token OAuth2 ────────────────────────────────────────────────────
async function getAirtelToken() {
    const credentials = Buffer.from(`${AIRTEL_CLIENT_ID}:${AIRTEL_CLIENT_SECRET}`).toString('base64');

    console.log('[Airtel] Génération token...');

    const res = await fetch(`${AIRTEL_BASE_URL}/auth/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            grant_type: 'client_credentials',
            client_id: AIRTEL_CLIENT_ID,
            client_secret: AIRTEL_CLIENT_SECRET
        })
    });

    const text = await res.text();

    if (!res.ok) {
        console.error('[Airtel] Token error:', res.status, text);
        throw new Error(`Token error ${res.status}`);
    }

    const data = JSON.parse(text);

    console.log('[Airtel] Token généré ✅');

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
            console.error(`[Airtel] Patient introuvable : ${phone}`);
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
                operator: 'airtel'
            })]
        ).catch(() => {});

        await client.query('COMMIT');
        console.log('[Airtel] ✅ Abonnement activé');
    } catch(e) {
        await client.query('ROLLBACK');
        console.error('handlePaymentSuccess error:', e.message);
        
        // Audit log en cas d'erreur
        try {
            await db.query(
                `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
                 VALUES ('payment.error', $1, 'payments', $2, $3::jsonb)`,
                [phone, referenceId, JSON.stringify({ error: e.message, operator: 'airtel' })]
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
             VALUES ($1, $2, $3, 'AIRTEL', 'pending', FALSE, NOW() + INTERVAL '30 days', NOW())
             RETURNING id`,
            [phone, plan, amount]
        );

        const referenceId = insertRes.rows[0].id.toString();

        console.log('[Airtel] ✅ Paiement enregistré en base (status=pending)');

        res.json({
            success: true,
            message: 'Demande de paiement enregistrée',
            reference_id: referenceId
        });

    } catch(e) {
        console.error('[Airtel] request error:', e.message);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ─── GET /status/:referenceId ─────────────────────────────────────────────────
router.get('/status/:referenceId', authMiddleware, async (req, res) => {
    try {
        const { referenceId } = req.params;
        const phone = req.user?.phone;
        const token = await getAirtelToken();

        const airtelRes = await fetch(`${AIRTEL_BASE_URL}/standard/v1/payments/${referenceId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Country': 'CG',
                'X-Currency': 'XAF'
            }
        });

        const data = await airtelRes.json();

        console.log('[Airtel] Status:', data.status?.response_code);

        if (data.status?.response_code === 'DP00800001001') {
            await handlePaymentSuccess(phone, referenceId);
        } else if (data.status?.response_code === 'DP00800001000') {
            await db.query(
                `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE reference = $1`,
                [referenceId]
            );
            await db.query(
                `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
                 VALUES ('payment.failed', $1, 'payments', $2, $3::jsonb)`,
                [phone, referenceId, JSON.stringify({ operator: 'airtel' })]
            ).catch(() => {});
        }

        res.json({ success: true, status: data.status?.response_code });

    } catch(e) {
        console.error('[Airtel] status error:', e.message);
        res.status(500).json({ success: false });
    }
});

// ─── POST /webhook ───────────────────────────────────────────────────────────────
router.post('/webhook', webhookLimiter, express.raw({ type: 'application/json' }), validateAirtelWebhook, idempotencyMiddleware('/airtel/webhook'), async (req, res) => {
    try {
        const webhookData = JSON.parse(req.body.toString());
        const { reference, status } = webhookData;

        console.log('[Airtel Webhook] Réception webhook:', reference, status);

        // Vérifier si le paiement existe
        const payRes = await db.query(
            'SELECT * FROM payments WHERE reference = $1',
            [reference]
        );

        if (!payRes.rows.length) {
            console.error('[Airtel Webhook] Paiement introuvable:', reference);
            return res.status(404).json({ success: false, message: 'Paiement introuvable' });
        }

        const payment = payRes.rows[0];

        // Si déjà traité, retourner succès (idempotence)
        if (payment.status === 'success') {
            return res.json({ success: true, message: 'Paiement déjà traité' });
        }

        // Traitement selon le statut
        if (status === 'success' || status === 'DP00800001001') {
            await handlePaymentSuccess(payment.patient_phone, reference);
        } else if (status === 'failed' || status === 'DP00800001000') {
            await db.query(
                `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE reference = $1`,
                [reference]
            );
            await db.query(
                `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
                 VALUES ('payment.failed', $1, 'payments', $2, $3::jsonb)`,
                [payment.patient_phone, reference, JSON.stringify({ operator: 'airtel' })]
            ).catch(() => {});
        }

        res.json({ success: true, message: 'Webhook traité avec succès' });

    } catch(e) {
        console.error('[Airtel Webhook] Erreur:', e.message);
        res.status(500).json({ success: false, message: 'Erreur traitement webhook' });
    }
});

// ─── POST /simulate-success (tests uniquement — désactivé en production) ──────
router.post('/simulate-success', authMiddleware, async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ success: false, message: 'Endpoint désactivé en production.' });
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
        console.error('[airtel/simulate-success]', e.message);
        res.status(500).json({ success: false });
    }
});

module.exports = router;
