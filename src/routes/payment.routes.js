const express = require('express');
const router = express.Router();
const db = require('../config/db');
const crypto = require('crypto');
const authMiddleware = require('../../middleware/auth.middleware');

// Générer une référence unique
function generateReference() {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `BOL-${timestamp}-${random}`;
}

// Initier un paiement (simulation)
router.post('/initiate', async (req, res) => {
    const { patient_phone, amount_fcfa, payment_type, subscription_id, appointment_id, plan } = req.body;

    try {
        // Validation du montant contre platform_config si plan fourni
        if (plan) {
            const configRes = await db.query(
                `SELECT config_value FROM platform_config WHERE config_key = $1`,
                [`price_${plan}`]
            );
            if (!configRes.rows.length) {
                return res.status(400).json({ success: false, message: 'Plan invalide.' });
            }
            const expectedAmount = parseInt(configRes.rows[0].config_value);
            if (parseInt(amount_fcfa) !== expectedAmount) {
                return res.status(400).json({
                    success: false,
                    message: `Montant incorrect. Attendu : ${expectedAmount} FCFA.`
                });
            }
        }

        const reference = generateReference();

        const result = await db.query(
            `INSERT INTO payments 
             (patient_phone, amount_fcfa, payment_type, payment_method, status, reference, subscription_id, appointment_id, plan)
             VALUES ($1, $2, $3, 'simulation', 'pending', $4, $5, $6, $7)
             RETURNING *`,
            [patient_phone, amount_fcfa, payment_type, reference, subscription_id || null, appointment_id || null, plan || null]
        );

        res.status(201).json({
            success: true,
            message: "Paiement initié. En attente de confirmation.",
            payment: result.rows[0]
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur lors de l'initiation du paiement" });
    }
});

// Confirmer un paiement (simulation du callback MTN MoMo)
router.post('/confirm/:reference', async (req, res) => {
    const { reference } = req.params;

    const client = await db.connect();

    try {
        await client.query('BEGIN');

        // 1. Récupérer le paiement
        const paymentResult = await client.query(
            `SELECT * FROM payments WHERE reference = $1`,
            [reference]
        );

        if (paymentResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: "Paiement introuvable." });
        }

        const payment = paymentResult.rows[0];

        if (payment.status === 'success') {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: "Ce paiement est déjà confirmé." });
        }

        // 2. Confirmer le paiement
        await client.query(
            `UPDATE payments SET status = 'success', updated_at = NOW() WHERE reference = $1`,
            [reference]
        );

        // 3. Si c'est un abonnement — activer l'abonnement du patient
        if (payment.plan) {
            // Désactiver les anciens abonnements actifs
            await client.query(
                `UPDATE subscriptions SET is_active = FALSE, status = 'expired'
                 WHERE patient_phone = $1 AND is_active = TRUE`,
                [payment.patient_phone]
            );

            // Créer le nouvel abonnement
            await client.query(
                `INSERT INTO subscriptions
                    (patient_phone, plan, amount_fcfa, status, started_at, expires_at, is_active, payment_reference)
                 VALUES ($1, $2, $3, 'active', NOW(), NOW() + INTERVAL '30 days', TRUE, $4)`,
                [payment.patient_phone, payment.plan, payment.amount_fcfa, reference]
            );
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: "Paiement confirmé !",
            reference: reference,
            type: payment.payment_type
        });

    } catch (err) {
        await client.query('ROLLBACK');
        
        // Marquer le paiement comme failed en cas d'erreur
        try {
            await db.query(
                `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE reference = $1`,
                [reference]
            );
        } catch (updateErr) {
            console.error('Erreur lors du marquage failed:', updateErr.message);
        }

        console.error(err);
        res.status(500).json({ error: "Erreur lors de la confirmation" });
    } finally {
        client.release();
    }
});

// Historique des paiements d'un patient
router.get('/history/:phone', authMiddleware, async (req, res) => {
    const { phone } = req.params;
    const currentUser = req.user;

    // Vérifier que l'utilisateur a le droit d'accéder à cet historique
    if (currentUser.phone !== phone && currentUser.role !== 'admin') {
        return res.status(403).json({ success: false, message: "Accès non autorisé." });
    }

    try {
        const result = await db.query(
            `SELECT id, amount_fcfa, payment_type, payment_method, status, reference, created_at
             FROM payments
             WHERE patient_phone = $1
             ORDER BY created_at DESC`,
            [phone]
        );
        res.json({ success: true, payments: result.rows });
    } catch (err) {
        res.status(500).json({ error: "Erreur lors de la récupération" });
    }
});

module.exports = router;