const pool = require('../config/db');

async function createPrescription(req, res) {
    const { appointment_id, patient_phone, doctor_phone, medications, instructions } = req.body;

    if (!patient_phone || !doctor_phone || !medications) {
        return res.status(400).json({
            success: false,
            message: 'Champs obligatoires manquants : patient_phone, doctor_phone, medications'
        });
    }

    try {
        const result = await pool.query(
            `INSERT INTO prescriptions 
                (appointment_id, patient_phone, doctor_phone, medications, instructions, status)
             VALUES ($1, $2, $3, $4, $5, 'active')
             RETURNING *`,
            [appointment_id || null, patient_phone, doctor_phone, medications, instructions || null]
        );

        return res.status(201).json({
            success: true,
            message: 'Ordonnance créée avec succès.',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('[createPrescription] Erreur :', error.message);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur. Réessayer.'
        });
    }
}

module.exports = { createPrescription };