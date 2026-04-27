// ============================================================
// BOLAMU — Routes Virements Bancaires
// ============================================================
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const crypto = require('crypto');
const authMiddleware = require('../../middleware/auth.middleware');

function adminOnly(req, res, next) {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
    }
    next();
}

// ─── GÉNÉRER RÉFÉRENCE STRUCTURÉE ───────────────────────────────────────────────
function generateBankReference(phone) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const random = crypto.randomBytes(3).toString('hex'); // 6 caractères hex uniques
    return `BOL-${phone}-${date}-${random}`;
}

// ─── POST /api/v1/bank-transfer/request ───────────────────────────────────────────
// Patient demande un virement bancaire
router.post('/request', authMiddleware, async (req, res) => {
    const { plan, destination_account_id } = req.body;
    const patient_phone = req.user.phone;

    if (!plan || !destination_account_id) {
        return res.status(400).json({ success: false, message: 'plan et destination_account_id requis.' });
    }

    try {
        // 1. Vérifier que le compte Bolamu existe
        const accountRes = await db.query(
            `SELECT account_id, account_reference, provider_name FROM bolamu_accounts 
             WHERE account_id = $1 AND is_active = TRUE`,
            [destination_account_id]
        );
        if (!accountRes.rows.length) {
            return res.status(404).json({ success: false, message: 'Compte Bolamu introuvable.' });
        }

        // 2. Récupérer le montant depuis platform_config
        const configRes = await db.query(
            `SELECT config_value FROM platform_config WHERE config_key = $1`,
            [`price_${plan}`]
        );
        if (!configRes.rows.length) {
            return res.status(400).json({ success: false, message: 'Plan invalide.' });
        }
        const amount_fcfa = parseInt(configRes.rows[0].config_value);

        // 3. Vérifier qu'il n'y a pas déjà une demande pending pour ce patient
        const existingRes = await db.query(
            `SELECT id FROM bank_transfer_requests 
             WHERE patient_phone = $1 AND status = 'pending'`,
            [patient_phone]
        );
        if (existingRes.rows.length) {
            return res.status(400).json({ success: false, message: 'Une demande de virement est déjà en cours.' });
        }

        // 4. Générer la référence structurée
        const reference = generateBankReference(patient_phone);

        // 5. Créer la demande de virement
        const result = await db.query(
            `INSERT INTO bank_transfer_requests 
                (reference, patient_phone, amount_fcfa, plan, status, destination_account_id)
             VALUES ($1, $2, $3, $4, 'pending', $5)
             RETURNING *`,
            [reference, patient_phone, amount_fcfa, plan, destination_account_id]
        );

        // 6. Audit log
        await db.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('bank_transfer.requested', $1, 'bank_transfer_requests', $2, $3)`,
            [patient_phone, result.rows[0].id.toString(), JSON.stringify({ plan, amount_fcfa, reference })]
        ).catch(() => {});

        res.status(201).json({
            success: true,
            message: 'Demande de virement créée. Effectuez le virement avec la référence ci-dessous.',
            request: result.rows[0],
            bank_account: accountRes.rows[0]
        });
    } catch (e) {
        console.error('POST /bank-transfer/request error:', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ─── GET /api/v1/bank-transfer/pending ─────────────────────────────────────────────
// Liste des virements en attente (admin)
router.get('/pending', authMiddleware, adminOnly, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT btr.*, u.full_name, ba.account_reference, ba.provider_name
             FROM bank_transfer_requests btr
             JOIN users u ON u.phone = btr.patient_phone
             JOIN bolamu_accounts ba ON ba.account_id = btr.destination_account_id
             WHERE btr.status = 'pending'
             ORDER BY btr.created_at DESC
             LIMIT 100`
        );
        res.json({ success: true, requests: result.rows });
    } catch (e) {
        console.error('GET /bank-transfer/pending error:', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ─── PATCH /api/v1/bank-transfer/:id/validate ───────────────────────────────────────
// Valider un virement et activer l'abonnement
router.patch('/:id/validate', authMiddleware, adminOnly, async (req, res) => {
    const { id } = req.params;
    const { external_reference } = req.body;

    const client = await db.connect();

    try {
        await client.query('BEGIN');

        // 1. Récupérer la demande de virement
        const reqRes = await client.query(
            `SELECT * FROM bank_transfer_requests WHERE id = $1 AND status = 'pending'`,
            [id]
        );
        if (!reqRes.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Demande introuvable ou déjà traitée.' });
        }
        const request = reqRes.rows[0];

        // 2. Mettre à jour le statut du virement
        await client.query(
            `UPDATE bank_transfer_requests 
             SET status = 'reconciled', external_reference = $1, validated_by = $2, validated_at = NOW()
             WHERE id = $3`,
            [external_reference || null, req.user.phone, id]
        );

        // 3. Désactiver les anciens abonnements actifs
        await client.query(
            `UPDATE subscriptions SET is_active = FALSE, status = 'expired'
             WHERE patient_phone = $1 AND is_active = TRUE`,
            [request.patient_phone]
        );

        // 4. Créer le nouvel abonnement
        const subRes = await client.query(
            `INSERT INTO subscriptions
                (patient_phone, plan, amount_fcfa, status, started_at, expires_at, is_active, payment_reference)
             VALUES ($1, $2, $3, 'active', NOW(), NOW() + INTERVAL '30 days', TRUE, $4)
             RETURNING id`,
            [request.patient_phone, request.plan, request.amount_fcfa, request.reference]
        );

        // 5. Lier l'abonnement à la demande de virement
        await client.query(
            `UPDATE bank_transfer_requests 
             SET status = 'activated', subscription_id = $1
             WHERE id = $2`,
            [subRes.rows[0].id, id]
        );

        await client.query('COMMIT');

        // 6. Audit log (hors transaction)
        await db.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('bank_transfer.activated', $1, 'bank_transfer_requests', $2, $3)`,
            [req.user.phone, id, JSON.stringify({ subscription_id: subRes.rows[0].id, external_reference })]
        ).catch(() => {});

        res.json({
            success: true,
            message: 'Virement validé et abonnement activé.',
            subscription_id: subRes.rows[0].id
        });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('PATCH /bank-transfer/:id/validate error:', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    } finally {
        client.release();
    }
});

// ─── PATCH /api/v1/bank-transfer/:id/reject ────────────────────────────────────────
// Rejeter un virement avec motif
router.patch('/:id/reject', authMiddleware, adminOnly, async (req, res) => {
    const { id } = req.params;
    const { notes } = req.body;

    if (!notes) {
        return res.status(400).json({ success: false, message: 'Motif du rejet requis.' });
    }

    try {
        const result = await db.query(
            `UPDATE bank_transfer_requests 
             SET status = 'rejected', notes = $1, validated_by = $2, validated_at = NOW()
             WHERE id = $3 AND status = 'pending'
             RETURNING *`,
            [notes, req.user.phone, id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: 'Demande introuvable ou déjà traitée.' });
        }

        // Audit log
        await db.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('bank_transfer.rejected', $1, 'bank_transfer_requests', $2, $3)`,
            [req.user.phone, id, JSON.stringify({ notes })]
        ).catch(() => {});

        res.json({ success: true, message: 'Virement rejeté.', request: result.rows[0] });
    } catch (e) {
        console.error('PATCH /bank-transfer/:id/reject error:', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
