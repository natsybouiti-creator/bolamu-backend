const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Générer une référence unique
function generateReference() {
    const timestamp = Date.now();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `BOL-${timestamp}-${random}`;
}

// Initier un paiement (simulation)
router.post('/initiate', async (req, res) => {
    const { patient_phone, amount_fcfa, payment_type, subscription_id, appointment_id } = req.body;

    try {
        const reference = generateReference();

        const result = await pool.query(
            `INSERT INTO payments 
             (patient_phone, amount_fcfa, payment_type, payment_method, status, reference, subscription_id, appointment_id)
             VALUES ($1, $2, $3, 'simulation', 'en_attente', $4, $5, $6)
             RETURNING *`,
            [patient_phone, amount_fcfa, payment_type, reference, subscription_id || null, appointment_id || null]
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

    try {
        // 1. Récupérer le paiement
        const paymentResult = await pool.query(
            `SELECT * FROM payments WHERE reference = $1`,
            [reference]
        );

        if (paymentResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Paiement introuvable." });
        }

        const payment = paymentResult.rows[0];

        if (payment.status === 'confirme') {
            return res.status(400).json({ success: false, message: "Ce paiement est déjà confirmé." });
        }

        // 2. Confirmer le paiement
        await pool.query(
            `UPDATE payments SET status = 'confirme', updated_at = NOW() WHERE reference = $1`,
            [reference]
        );

        // 3. Si c'est un abonnement — activer l'abonnement du patient
        

        res.json({
            success: true,
            message: "Paiement confirmé !",
            reference: reference,
            type: payment.payment_type
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur lors de la confirmation" });
    }
});

// Historique des paiements d'un patient
router.get('/history/:phone', async (req, res) => {
    const { phone } = req.params;
    try {
        const result = await pool.query(
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