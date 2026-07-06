// ============================================================
// BOLAMU — Routes Clearing Mensuel Partenaires
// ============================================================
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const crypto = require('crypto');
const authMiddleware = require('../middleware/auth.middleware');
const { calculerReversement, validerClearing } = require('../services/billing.service');
const { sendAutoMessage } = require('../services/whatsapp.service');

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
        // Taux CDR par type de partenaire (platform_config — jamais hardcodé).
        // Ne s'applique qu'à pharmacie/laboratoire : le type 'partenaire' de
        // clearing_transactions correspond aux règlements de vouchers Zora
        // (zora-voucher.service.js), un mécanisme distinct de la CDR par
        // abonnement (§7 ARCHITECTURE_FINANCIERE_BOLAMU.md) — pas de taux à afficher.
        const ratesResult = await db.query(
            `SELECT config_key, config_value FROM platform_config
             WHERE config_key IN ('partner_rate_pharmacie', 'partner_rate_laboratoire', 'partner_rate_clinique')`
        );
        const rateByType = {};
        ratesResult.rows.forEach(r => { rateByType[r.config_key.replace('partner_rate_', '')] = parseFloat(r.config_value); });

        const result = await db.query(
            `SELECT
                pp.*,
                u.full_name as partner_name,
                pz.zone_name
             FROM partner_payouts pp
             LEFT JOIN partner_zones pz ON pz.partner_phone = pp.partner_phone AND pz.partner_type = pp.partner_type
             LEFT JOIN users u ON u.phone = pp.partner_phone
             WHERE pp.status = 'pending'
             ORDER BY pp.period_start DESC, pp.partner_phone`
        );

        // Détecter opérateur + taux CDR pour chaque payout
        const payouts = result.rows.map(p => {
            const rate = rateByType[p.partner_type];
            return {
                ...p,
                operator: detectOperator(p.momo_number),
                taux_cdr: rate != null ? +(rate * 100).toFixed(2) : null
            };
        });

        res.json({ success: true, payouts });
    } catch (e) {
        console.error('GET /clearing/pending error:', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ─── GET /dashboard (alias KPI) ───────────────────────────────────────────────
router.get('/dashboard', authMiddleware, adminOnly, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT
                COUNT(*) as total_lignes,
                COALESCE(SUM(amount_fcfa), 0) as total_cdr,
                COALESCE(SUM(nb_adherents_zone), 0) as total_abonnes
             FROM partner_payouts
             WHERE status = 'pending'`
        );
        const row = result.rows[0] || {};
        res.json({
            success: true,
            dashboard: {
                total_cdr: parseFloat(row.total_cdr || 0),
                total_lignes: parseInt(row.total_lignes || 0),
                total_abonnes: parseInt(row.total_abonnes || 0)
            }
        });
    } catch (e) {
        console.error('GET /clearing/dashboard error:', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ─── POST /run ───────────────────────────────────────────────────────────────────
// Calcule et clôture les clearing_transactions pending du mois en cours par
// partenaire, crée les partner_payouts correspondants (billing.service.js).
router.post('/run', authMiddleware, adminOnly, async (req, res) => {
    try {
        const now = new Date();
        const periode = {
            debut: new Date(now.getFullYear(), now.getMonth(), 1),
            fin: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
        };

        // partner_payouts.partner_type est un ENUM restreint à
        // clinique/pharmacie/laboratoire (vérifié sur Neon) — le type
        // 'partenaire' de clearing_transactions (règlements vouchers Zora,
        // zora-voucher.service.js) ne peut pas y être inséré : mécanisme de
        // règlement distinct, hors périmètre de ce pipeline CDR.
        const partnersResult = await db.query(
            `SELECT DISTINCT partner_phone, partner_type
             FROM clearing_transactions
             WHERE status = 'pending' AND partner_type IN ('pharmacie', 'laboratoire', 'clinique')
             AND created_at BETWEEN $1 AND $2`,
            [periode.debut, periode.fin]
        );

        const details = [];
        let montant_total = 0;

        for (const row of partnersResult.rows) {
            const apercu = await calculerReversement(row.partner_phone, row.partner_type, periode);
            if (!apercu.nb_transactions) continue;
            const { cleared_count, total_fcfa } = await validerClearing(row.partner_phone, row.partner_type, periode);
            if (cleared_count > 0) {
                montant_total += total_fcfa;
                details.push({
                    partner_phone: row.partner_phone,
                    partner_type: row.partner_type,
                    nb_transactions: cleared_count,
                    montant_fcfa: total_fcfa
                });
            }
        }

        await db.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, payload)
             VALUES ('clearing.run', $1, 'partner_payouts', $2::jsonb)`,
            [req.user.phone, JSON.stringify({ periode, partenaires_traites: details.length, montant_total, details })]
        ).catch(() => {});

        res.json({
            success: true,
            message: `Clearing exécuté : ${details.length} partenaire(s) traité(s), ${montant_total} FCFA au total.`,
            partenaires_traites: details.length,
            montant_total,
            details
        });
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
             VALUES ('clearing.paid', $1, 'partner_payouts', $2, $3::jsonb)`,
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
             VALUES ('clearing.failed', $1, 'partner_payouts', $2, $3::jsonb)`,
            [req.user.phone, id, JSON.stringify({ notes })]
        ).catch(() => {});

        res.json({ success: true, message: 'Versement marqué comme échoué.', payout: result.rows[0] });
    } catch (e) {
        console.error('PATCH /clearing/:id/fail error:', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ============================================================
// RÈGLEMENT BONS ZORA PARTENAIRES RÉCOMPENSES (bon_zora_reglements)
// Les clearing_transactions de type 'partenaire' (bons Zora validés)
// ne peuvent pas entrer dans le pipeline CDR (partner_payouts.partner_type
// ENUM exclut 'partenaire') — pipeline dédié ci-dessous.
// Terminologie : 'voucher' remplacé par 'bon Zora' (décision produit, sprint dette technique)
// ============================================================

// ─── POST /bons-zora/run ──────────────────────────────────────────────────────
// Agrège les clearing_transactions pending de type 'partenaire' et crée
// les bon_zora_reglements correspondants.
router.post('/bons-zora/run', authMiddleware, adminOnly, async (req, res) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');

        // 1. Charger les transactions bons Zora pending (verrou)
        const txResult = await client.query(
            `SELECT ct.id, ct.partner_phone, ct.partner_type, ct.amount_fcfa, bz.uuid as bon_uuid
             FROM clearing_transactions ct
             JOIN partner_bons_zora bz ON bz.id = ct.reference_id
             WHERE ct.status = 'pending' AND ct.partner_type = 'partenaire' AND ct.reference_type = 'bon_zora'
             ORDER BY ct.id
             FOR UPDATE OF ct`
        );

        if (txResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.json({ success: true, message: 'Aucune transaction bon Zora en attente.', reglements_crees: 0 });
        }

        // 2. Créer un bon_zora_reglement par transaction et marquer la transaction validée
        const reglements = [];
        for (const tx of txResult.rows) {
            const reglementResult = await client.query(
                `INSERT INTO bon_zora_reglements (partner_phone, bon_uuid, amount_fcfa, status)
                 VALUES ($1, $2, $3, 'pending')
                 RETURNING id, partner_phone, bon_uuid, amount_fcfa, status, created_at`,
                [tx.partner_phone, tx.bon_uuid, tx.amount_fcfa]
            );
            await client.query(
                `UPDATE clearing_transactions SET status = 'validated' WHERE id = $1`,
                [tx.id]
            );
            reglements.push(reglementResult.rows[0]);
        }

        await client.query('COMMIT');

        // 3. Audit log (hors transaction)
        await db.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, payload)
             VALUES ('clearing.bons-zora.run', $1, 'bon_zora_reglements', $2::jsonb)`,
            [req.user.phone, JSON.stringify({
                reglements_crees: reglements.length,
                montant_total: reglements.reduce((s, p) => s + p.amount_fcfa, 0),
                reglement_ids: reglements.map(p => p.id)
            })]
        ).catch(() => {});

        // 4. Notifier chaque partenaire WhatsApp (non bloquant)
        setImmediate(async () => {
            for (const r of reglements) {
                try {
                    await sendAutoMessage(r.partner_phone, 'bolamu_bon_zora_reglement', [
                        r.amount_fcfa,
                        `BZR-${r.id}`
                    ]);
                } catch (whatsappErr) {
                    console.error('[CLEARING BONS ZORA] Erreur envoi WhatsApp (non bloquante):', whatsappErr.message);
                }
            }
        });

        res.json({
            success: true,
            message: `${reglements.length} règlement(s) bon Zora créé(s).`,
            reglements_crees: reglements.length,
            reglements
        });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('POST /clearing/bons-zora/run error:', e.message);
        res.status(500).json({ success: false, message: 'Erreur lors de la création des règlements bons Zora.' });
    } finally {
        client.release();
    }
});

// ─── GET /bons-zora/pending ───────────────────────────────────────────────────
router.get('/bons-zora/pending', authMiddleware, adminOnly, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT bzr.id, bzr.partner_phone, bzr.bon_uuid, bzr.amount_fcfa,
                    bzr.status, bzr.created_at, bzr.paid_at, bzr.reference_virement,
                    zp.name as partner_name
             FROM bon_zora_reglements bzr
             LEFT JOIN zora_partners zp ON zp.phone = bzr.partner_phone
             WHERE bzr.status = 'pending'
             ORDER BY bzr.created_at DESC`
        );
        res.json({ success: true, reglements: result.rows });
    } catch (e) {
        console.error('GET /clearing/bons-zora/pending error:', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ─── PATCH /bons-zora/:id/pay ─────────────────────────────────────────────────
router.patch('/bons-zora/:id/pay', authMiddleware, adminOnly, async (req, res) => {
    const { id } = req.params;
    const { reference_virement } = req.body;

    if (!reference_virement) {
        return res.status(400).json({ success: false, message: 'Référence de virement obligatoire.' });
    }

    try {
        const result = await db.query(
            `UPDATE bon_zora_reglements
             SET status = 'paid', reference_virement = $1, paid_at = NOW()
             WHERE id = $2 AND status = 'pending'
             RETURNING id, partner_phone, bon_uuid, amount_fcfa, status, paid_at, reference_virement`,
            [reference_virement, id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: 'Règlement introuvable ou déjà traité.' });
        }
        const reglement = result.rows[0];

        // Audit log
        await db.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('clearing.bons-zora.paid', $1, 'bon_zora_reglements', $2, $3::jsonb)`,
            [req.user.phone, id, JSON.stringify({
                partner_phone: reglement.partner_phone,
                amount_fcfa: reglement.amount_fcfa,
                reference_virement
            })]
        ).catch(() => {});

        res.json({ success: true, message: 'Règlement bon Zora payé.', reglement });
    } catch (e) {
        console.error('PATCH /clearing/bons-zora/:id/pay error:', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
