const express = require('express');
const router = express.Router();
const db = require('../config/db');

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

// ─── UUID natif ───────────────────────────────────────────────────────────────
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// ─── CONFIG MOMO ─────────────────────────────────────────────────────────────
const MOMO_BASE_URL = 'https://sandbox.momodeveloper.mtn.com';
const SUBSCRIPTION_KEY = process.env.MOMO_SUBSCRIPTION_KEY;
const API_USER = process.env.MOMO_API_USER;
const API_KEY = process.env.MOMO_API_KEY;
const IS_SANDBOX = true; // passer à false en production

// ─── HELPER : token OAuth2 ────────────────────────────────────────────────────
async function getMoMoToken() {
    const credentials = Buffer.from(`${API_USER}:${API_KEY}`).toString('base64');
    console.log('[MoMo] Génération token avec API_USER:', API_USER?.slice(0,8)+'...');
    const res = await fetch(`${MOMO_BASE_URL}/collection/token/`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
            'X-Target-Environment': 'sandbox'
        }
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Token MoMo échoué (${res.status}): ${err}`);
    }
    const data = await res.json();
    console.log('[MoMo] Token généré ✅');
    return data.access_token;
}

// ─── HELPER : traiter paiement réussi ────────────────────────────────────────
async function handlePaymentSuccess(phone, referenceId) {
    try {
        const payRes = await db.query('SELECT * FROM payments WHERE reference = $1', [referenceId]);
        if (!payRes.rows.length) return;
        const payment = payRes.rows[0];
        if (payment.status === 'success') return;

        await db.query(
            `UPDATE payments SET status = 'success', updated_at = NOW() WHERE reference = $1`,
            [referenceId]
        );

        await db.query(
            `UPDATE users SET 
                statut_abonnement = 'actif',
                date_fin_abonnement = NOW() + INTERVAL '30 days',
                is_active = TRUE
             WHERE phone = $1`,
            [phone]
        );

        await db.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('payment_successful', $1, 'payments', $2, $3)`,
            [phone, referenceId, JSON.stringify({ plan: payment.plan, amount: payment.amount_fcfa })]
        ).catch(() => {});

        console.log(`✅ Paiement confirmé pour ${phone} — plan ${payment.plan}`);
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

        console.log('[MoMo] Requête paiement pour:', phone, 'plan:', plan, 'montant:', amount);

        const referenceId = generateUUID();
        const token = await getMoMoToken();

        const payBody = {
            amount: '100',           // sandbox : montant fixe 100 EUR
            currency: 'EUR',         // sandbox : EUR obligatoire
            externalId: referenceId,
            payer: {
                partyIdType: 'MSISDN',
                partyId: '46733123450'  // sandbox : numéro de test MTN
            },
            payerMessage: `Abonnement Bolamu ${plan}`,
            payeeNote: `Bolamu ${plan} — ${phone}`
        };

        console.log('[MoMo] Envoi requesttopay avec ref:', referenceId);

        const momoRes = await fetch(`${MOMO_BASE_URL}/collection/v1_0/requesttopay`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Reference-Id': referenceId,
                'X-Target-Environment': 'sandbox',
                'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payBody)
        });

        console.log('[MoMo] Réponse status:', momoRes.status);

        if (momoRes.status !== 202) {
            const errText = await momoRes.text();
            console.error('[MoMo] Erreur requesttopay:', momoRes.status, errText);
            return res.status(400).json({ success: false, message: `Erreur MoMo (${momoRes.status}): ${errText}` });
        }

        await db.query(
            `INSERT INTO payments (patient_phone, amount_fcfa, operator, plan, reference, status, created_at)
             VALUES ($1, $2, 'mtn', $3, $4, 'pending', NOW())
             ON CONFLICT DO NOTHING`,
            [phone, amount, plan, referenceId]
        );

        await db.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('payment_initiated', $1, 'payments', $2, $3)`,
            [phone, referenceId, JSON.stringify({ amount, plan })]
        ).catch(() => {});

        console.log('[MoMo] ✅ Paiement initié avec succès, ref:', referenceId);

        res.json({
            success: true,
            message: 'Demande de paiement envoyée sur votre téléphone MTN MoMo',
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
        console.log('[MoMo] Status check:', referenceId, '→', data.status);

        if (data.status === 'SUCCESSFUL') {
            await handlePaymentSuccess(phone, referenceId);
        } else if (data.status === 'FAILED') {
            await db.query(
                `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE reference = $1`,
                [referenceId]
            ).catch(() => {});
        }

        res.json({ success: true, status: data.status, data });

    } catch(e) {
        console.error('[MoMo] status error:', e.message);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ─── POST /callback ───────────────────────────────────────────────────────────
router.post('/callback', async (req, res) => {
    try {
        const body = req.body;
        console.log('📲 MoMo Callback reçu:', JSON.stringify(body));
        const referenceId = body.externalId || body.financialTransactionId;
        const status = body.status;
        if (!referenceId) return res.status(200).json({ received: true });
        const payRes = await db.query('SELECT * FROM payments WHERE reference = $1', [referenceId]);
        if (!payRes.rows.length) return res.status(200).json({ received: true });
        const payment = payRes.rows[0];
        if (status === 'SUCCESSFUL') {
            await handlePaymentSuccess(payment.patient_phone, referenceId);
        } else if (status === 'FAILED') {
            await db.query(`UPDATE payments SET status = 'failed', updated_at = NOW() WHERE reference = $1`, [referenceId]).catch(() => {});
        }
        res.status(200).json({ received: true });
    } catch(e) {
        console.error('MoMo callback error:', e.message);
        res.status(200).json({ received: true });
    }
});

// ─── GET /history ─────────────────────────────────────────────────────────────
router.get('/history', verifyToken, async (req, res) => {
    try {
        const phone = req.user?.phone;
        const { rows } = await db.query(
            `SELECT * FROM payments WHERE patient_phone = $1 ORDER BY created_at DESC LIMIT 20`,
            [phone]
        );
        res.json({ success: true, data: rows });
    } catch(e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

module.exports = router;