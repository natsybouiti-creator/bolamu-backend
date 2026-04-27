// ============================================================
// BOLAMU — Routes Airtel Money
// ============================================================
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const crypto = require('crypto');
const authMiddleware = require('../../middleware/auth.middleware');

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
    try {
        const payRes = await db.query(
            'SELECT * FROM payments WHERE reference = $1',
            [referenceId]
        );
        if (!payRes.rows.length) return;
        const payment = payRes.rows[0];
        if (payment.status === 'success') return;

        // 1. Mettre à jour le statut du paiement
        await db.query(
            `UPDATE payments SET status = 'success', updated_at = NOW() WHERE reference = $1`,
            [referenceId]
        );

        // 2. Désactiver les anciens abonnements actifs
        await db.query(
            `UPDATE subscriptions SET is_active = FALSE, status = 'expired'
             WHERE patient_phone = $1 AND is_active = TRUE`,
            [phone]
        );

        // 3. Créer le nouvel abonnement dans subscriptions
        await db.query(
            `INSERT INTO subscriptions
                (patient_phone, plan, amount_fcfa, status, started_at, expires_at, is_active, payment_reference)
             VALUES ($1, $2, $3, 'active', NOW(), NOW() + INTERVAL '30 days', TRUE, $4)`,
            [phone, payment.plan, payment.amount_fcfa, referenceId]
        );

        // 4. Audit log
        await db.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('payment.success', $1, 'subscriptions', $2, $3)`,
            [phone, referenceId, JSON.stringify({
                plan: payment.plan,
                amount_fcfa: payment.amount_fcfa,
                operator: 'airtel'
            })]
        ).catch(() => {});

        console.log('[Airtel] ✅ Abonnement activé');
    } catch(e) {
        console.error('handlePaymentSuccess error:', e.message);
    }
}

// ─── POST /request ────────────────────────────────────────────────────────────
router.post('/request', authMiddleware, async (req, res) => {
    try {
        const phone = req.user?.phone;
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

        console.log('[Airtel] Requête paiement initiée');

        const referenceId = crypto.randomUUID();
        const token = await getAirtelToken();

        const airtelPhone = phone.replace('+', '').replace(/^2420/, '242');

        const bodyData = JSON.stringify({
            reference: referenceId,
            subscriber: {
                country: 'CG',
                currency: 'XAF',
                msisdn: airtelPhone
            },
            transaction: {
                amount: String(amount),
                country: 'CG',
                currency: 'XAF',
                id: referenceId
            }
        });

        console.log('[Airtel] Envoi paiement...');

        const airtelRes = await fetch(`${AIRTEL_BASE_URL}/merchant/v2/payments/`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'X-Country': 'CG',
                'X-Currency': 'XAF'
            },
            body: bodyData
        });

        const responseText = await airtelRes.text();

        console.log('[Airtel] Réponse status:', airtelRes.status);

        if (airtelRes.status !== 202) {
            console.error('[Airtel] Erreur API:', airtelRes.status);
            return res.status(400).json({
                success: false,
                message: 'Erreur lors de l\'initiation du paiement Airtel.'
            });
        }

        await db.query(
            `INSERT INTO payments (patient_phone, amount_fcfa, operator, plan, reference, status, created_at)
             VALUES ($1, $2, 'airtel', $3, $4, 'pending', NOW())`,
            [phone, amount, plan, referenceId]
        );

        console.log('[Airtel] ✅ Paiement initié avec succès');

        res.json({
            success: true,
            message: 'Demande de paiement envoyée',
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
                 VALUES ('payment.failed', $1, 'payments', $2, $3)`,
                [phone, referenceId, JSON.stringify({ operator: 'airtel' })]
            ).catch(() => {});
        }

        res.json({ success: true, status: data.status?.response_code });

    } catch(e) {
        console.error('[Airtel] status error:', e.message);
        res.status(500).json({ success: false });
    }
});

module.exports = router;
