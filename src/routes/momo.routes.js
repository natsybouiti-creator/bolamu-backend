const express = require('express');
const router = express.Router();
const db = require('../config/db');
const crypto = require('crypto');

// ─── Import middleware ────────────────────────────────────────────────────────
let verifyToken;
try {
    const authMiddleware = require('../../middleware/auth.middleware');
    verifyToken = authMiddleware.verifyToken || authMiddleware.authenticate || authMiddleware.default || authMiddleware;
    if (typeof verifyToken !== 'function') throw new Error('verifyToken non trouvé');
} catch(e) {
    console.error('Auth middleware error:', e.message);
    verifyToken = (req, res, next) => next();
}

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
                operator: 'mtn'
            })]
        ).catch(() => {});

        console.log(`✅ Abonnement ${payment.plan} activé pour ${phone}`);
    } catch(e) {
        console.error('handlePaymentSuccess error:', e.message);
    }
}

// ─── POST /request ────────────────────────────────────────────────────────────
router.post('/request', verifyToken, async (req, res) => {
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

        console.log('[MoMo] Requête paiement pour:', phone, 'plan:', plan, 'montant:', amount);

        const referenceId = crypto.randomUUID(); // ✅ UUID fiable
        const token = await getMoMoToken();

        const momoPhone = phone.replace('+', '').replace(/^2420/, '242');

        const bodyData = JSON.stringify({
            amount: String(amount),
            currency: "XAF",
            externalId: referenceId,
            payer: {
                partyIdType: "MSISDN",
                partyId: momoPhone
            },
            payerMessage: `Abonnement Bolamu - Plan ${plan}`,
            payeeNote: "Bolamu Healthcare"
        });

        console.log('[MoMo] Envoi requesttopay avec ref:', referenceId);

        const momoRes = await fetch(`${MOMO_BASE_URL}/collection/v1_0/requesttopay`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Reference-Id': referenceId,
                'X-Target-Environment': 'sandbox',
                'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(bodyData) // ✅ FIX FINAL
            },
            body: bodyData
        });

        const responseText = await momoRes.text();

        console.log('[MoMo] Réponse status:', momoRes.status);
        console.log('[MoMo] Réponse body:', responseText);

        if (momoRes.status !== 202) {
            return res.status(400).json({
                success: false,
                message: `Erreur MoMo (${momoRes.status})`,
                details: responseText
            });
        }

        await db.query(
            `INSERT INTO payments (patient_phone, amount_fcfa, operator, plan, reference, status, created_at)
             VALUES ($1, $2, 'mtn', $3, $4, 'pending', NOW())`,
            [phone, amount, plan, referenceId]
        );

        console.log('[MoMo] ✅ Paiement initié avec succès');

        res.json({
            success: true,
            message: 'Demande de paiement envoyée',
            reference_id: referenceId
        });

    } catch(e) {
        console.error('[MoMo] request error:', e.message);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ─── GET /status/:referenceId ─────────────────────────────────────────────────
router.get('/status/:referenceId', verifyToken, async (req, res) => {
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
        }

        res.json({ success: true, status: data.status });

    } catch(e) {
        console.error('[MoMo] status error:', e.message);
        res.status(500).json({ success: false });
    }
});

module.exports = router;