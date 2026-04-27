// ============================================================
// BOLAMU — Routes Clearing Mensuel Partenaires
// ============================================================
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const crypto = require('crypto');
const authMiddleware = require('../../middleware/auth.middleware');
const { runClearing } = require('../../scripts/clearing-mensuel');

// ─── CONFIG MTN DISBURSEMENT (versements sortants) ───────────────────────────────
const MOMO_BASE_URL = 'https://sandbox.momodeveloper.mtn.com';
const MOMO_DISBURSEMENT_SUBSCRIPTION_KEY = process.env.MOMO_DISBURSEMENT_SUBSCRIPTION_KEY;
const MOMO_DISBURSEMENT_API_USER = process.env.MOMO_DISBURSEMENT_API_USER;
const MOMO_DISBURSEMENT_API_KEY = process.env.MOMO_DISBURSEMENT_API_KEY;

// ─── CONFIG AIRTEL ───────────────────────────────────────────────────────────
const AIRTEL_BASE_URL = process.env.AIRTEL_BASE_URL || 'https://openapi.airtel.africa';
const AIRTEL_CLIENT_ID = process.env.AIRTEL_CLIENT_ID;
const AIRTEL_CLIENT_SECRET = process.env.AIRTEL_CLIENT_SECRET;

// ─── ADMIN ONLY MIDDLEWARE ───────────────────────────────────────────────────
function adminOnly(req, res, next) {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
    }
    next();
}

// ─── HELPER : détecter opérateur depuis numéro ───────────────────────────────
function detectOperator(phone) {
    if (!phone) return null;
    const normalized = phone.replace('+', '').replace(/^2420/, '242');
    if (normalized.startsWith('24206') || normalized.startsWith('24205')) {
        return 'mtn';
    } else if (normalized.startsWith('24207') || normalized.startsWith('24204')) {
        return 'airtel';
    }
    return null;
}

// ─── HELPER : token MTN Disbursement ───────────────────────────────────────────
async function getMoMoDisbursementToken() {
    const credentials = Buffer.from(`${MOMO_DISBURSEMENT_API_USER}:${MOMO_DISBURSEMENT_API_KEY}`).toString('base64');
    const res = await fetch(`${MOMO_BASE_URL}/disbursement/token/`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Ocp-Apim-Subscription-Key': MOMO_DISBURSEMENT_SUBSCRIPTION_KEY
        }
    });
    if (!res.ok) throw new Error(`MTN Disbursement Token error ${res.status}`);
    const data = await res.json();
    return data.access_token;
}

// ─── HELPER : token Airtel ────────────────────────────────────────────────────
async function getAirtelToken() {
    const credentials = Buffer.from(`${AIRTEL_CLIENT_ID}:${AIRTEL_CLIENT_SECRET}`).toString('base64');
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
    if (!res.ok) throw new Error(`Airtel Token error ${res.status}`);
    const data = await res.json();
    return data.access_token;
}

// ─── HELPER : envoyer paiement MTN Disbursement ───────────────────────────────
async function sendMoMoDisbursement(momoNumber, amount, reference) {
    const token = await getMoMoDisbursementToken();
    const momoPhone = momoNumber.replace('+', '').replace(/^2420/, '242');
    const bodyData = JSON.stringify({
        amount: String(amount),
        currency: "XAF",
        externalId: reference,
        payee: {
            partyIdType: "MSISDN",
            partyId: momoPhone
        },
        payerMessage: "Versement Bolamu",
        payeeNote: "Bolamu Healthcare"
    });
    const momoRes = await fetch(`${MOMO_BASE_URL}/disbursement/v1_0/transfer`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'X-Reference-Id': reference,
            'X-Target-Environment': 'sandbox',
            'Ocp-Apim-Subscription-Key': MOMO_DISBURSEMENT_SUBSCRIPTION_KEY,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(bodyData)
        },
        body: bodyData
    });
    if (momoRes.status !== 202) {
        throw new Error(`MTN Disbursement failed: ${momoRes.status}`);
    }
    return reference;
}

// ─── HELPER : envoyer paiement Airtel ────────────────────────────────────────────
async function sendAirtelPayment(momoNumber, amount, reference) {
    const token = await getAirtelToken();
    const airtelPhone = momoNumber.replace('+', '').replace(/^2420/, '242');
    const bodyData = JSON.stringify({
        reference: reference,
        subscriber: {
            country: 'CG',
            currency: 'XAF',
            msisdn: airtelPhone
        },
        transaction: {
            amount: String(amount),
            country: 'CG',
            currency: 'XAF',
            id: reference
        }
    });
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
    if (airtelRes.status !== 202) {
        throw new Error(`Airtel payment failed: ${airtelRes.status}`);
    }
    return reference;
}

// ─── GET /pending ───────────────────────────────────────────────────────────────
router.get('/pending', authMiddleware, adminOnly, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT 
                pp.*,
                CASE 
                    WHEN pp.partner_type = 'doctor' THEN d.full_name
                    WHEN pp.partner_type = 'pharmacie' THEN ph.name
                    WHEN pp.partner_type = 'laboratoire' THEN l.name
                END as partner_name,
                pz.zone_name,
                pz.fee_per_adherent
             FROM partner_payouts pp
             LEFT JOIN partner_zones pz ON pz.partner_phone = pp.partner_phone AND pz.partner_type = pp.partner_type
             LEFT JOIN doctors d ON d.phone = pp.partner_phone
             LEFT JOIN pharmacies ph ON ph.phone = pp.partner_phone
             LEFT JOIN laboratories l ON l.phone = pp.partner_phone
             WHERE pp.status = 'pending'
             ORDER BY pp.period_start DESC, pp.partner_phone`
        );
        
        // Détecter opérateur pour chaque payout
        const payouts = result.rows.map(p => ({
            ...p,
            operator: detectOperator(p.momo_number)
        }));
        
        res.json({ success: true, payouts });
    } catch (e) {
        console.error('GET /clearing/pending error:', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ─── POST /run ───────────────────────────────────────────────────────────────────
router.post('/run', authMiddleware, adminOnly, async (req, res) => {
    try {
        await runClearing();
        res.json({ success: true, message: 'Clearing exécuté avec succès.' });
    } catch (e) {
        console.error('POST /clearing/run error:', e.message);
        res.status(500).json({ success: false, message: 'Erreur lors de l\'exécution du clearing.' });
    }
});

// ─── PATCH /:id/pay ─────────────────────────────────────────────────────────────
router.patch('/:id/pay', authMiddleware, adminOnly, async (req, res) => {
    const { id } = req.params;
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        // 1. Récupérer le payout
        const payoutRes = await client.query(
            `SELECT * FROM partner_payouts WHERE id = $1 AND status = 'pending'`,
            [id]
        );
        if (!payoutRes.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Versement introuvable ou déjà traité.' });
        }
        const payout = payoutRes.rows[0];

        if (!payout.momo_number) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Ce partenaire n\'a pas de numéro mobile money enregistré.' });
        }

        // 2. Détecter l'opérateur
        const operator = detectOperator(payout.momo_number);
        if (!operator) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Opérateur non détecté pour ce numéro.' });
        }

        // 3. Générer une référence
        const reference = crypto.randomUUID();

        // 4. Envoyer le paiement selon l'opérateur
        if (operator === 'mtn') {
            await sendMoMoDisbursement(payout.momo_number, payout.amount_fcfa, reference);
        } else if (operator === 'airtel') {
            await sendAirtelPayment(payout.momo_number, payout.amount_fcfa, reference);
        }

        // 5. Mettre à jour le payout
        await client.query(
            `UPDATE partner_payouts 
             SET status = 'paid', momo_reference = $1, validated_by = $2, validated_at = NOW(), updated_at = NOW()
             WHERE id = $3`,
            [reference, req.user.phone, id]
        );

        await client.query('COMMIT');

        // 6. Audit log (hors transaction)
        await db.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('clearing.paid', $1, 'partner_payouts', $2, $3)`,
            [req.user.phone, id, JSON.stringify({
                partner_phone: payout.partner_phone,
                partner_type: payout.partner_type,
                amount_fcfa: payout.amount_fcfa,
                operator: operator,
                momo_reference: reference
            })]
        ).catch(() => {});

        res.json({ success: true, message: 'Versement effectué avec succès.', payout: { ...payout, status: 'paid', momo_reference: reference } });

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('PATCH /clearing/:id/pay error:', e.message);
        res.status(500).json({ success: false, message: 'Erreur lors du paiement.' });
    } finally {
        client.release();
    }
});

// ─── PATCH /:id/fail ─────────────────────────────────────────────────────────────
router.patch('/:id/fail', authMiddleware, adminOnly, async (req, res) => {
    const { id } = req.params;
    const { notes } = req.body;
    
    if (!notes) {
        return res.status(400).json({ success: false, message: 'Notes obligatoires.' });
    }

    try {
        const result = await db.query(
            `UPDATE partner_payouts 
             SET status = 'failed', notes = $1, validated_by = $2, validated_at = NOW(), updated_at = NOW()
             WHERE id = $3 AND status = 'pending'
             RETURNING *`,
            [notes, req.user.phone, id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: 'Versement introuvable ou déjà traité.' });
        }

        // Audit log
        await db.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('clearing.failed', $1, 'partner_payouts', $2, $3)`,
            [req.user.phone, id, JSON.stringify({ notes })]
        ).catch(() => {});

        res.json({ success: true, message: 'Versement marqué comme échoué.', payout: result.rows[0] });
    } catch (e) {
        console.error('PATCH /clearing/:id/fail error:', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
