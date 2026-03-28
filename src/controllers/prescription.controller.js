const pool = require('../config/db');

// ─── CRÉER UNE ORDONNANCE (médecin après validation consultation) ─────────────
async function createPrescription(req, res) {
    const { appointment_id, patient_phone, doctor_phone, medications, instructions } = req.body;

    if (!patient_phone || !doctor_phone || !medications) {
        return res.status(400).json({
            success: false,
            message: 'Champs obligatoires manquants : patient_phone, doctor_phone, medications'
        });
    }

    try {
        // Récupérer le session_code depuis l'appointment
        let session_code = null;
        if (appointment_id) {
            const appt = await pool.query(
                'SELECT session_code FROM appointments WHERE id = $1',
                [appointment_id]
            );
            if (appt.rows.length > 0) {
                session_code = appt.rows[0].session_code;
            }
        }

        // Vérifier qu'il n'existe pas déjà une ordonnance active pour ce RDV
        if (appointment_id) {
            const existing = await pool.query(
                `SELECT id FROM prescriptions WHERE appointment_id = $1 AND status = 'active'`,
                [appointment_id]
            );
            if (existing.rows.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'Une ordonnance active existe déjà pour ce rendez-vous.'
                });
            }
        }

        const result = await pool.query(
            `INSERT INTO prescriptions 
                (appointment_id, patient_phone, doctor_phone, medications, instructions, status, session_code)
             VALUES ($1, $2, $3, $4, $5, 'active', $6)
             RETURNING *`,
            [appointment_id || null, patient_phone, doctor_phone, medications, instructions || null, session_code]
        );

        return res.status(201).json({
            success: true,
            message: 'Ordonnance créée avec succès.',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('[createPrescription] Erreur :', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── RÉCUPÉRER ORDONNANCE PAR CODE SESSION (pharmacie scanner) ───────────────
async function getPrescriptionBySession(req, res) {
    const { code } = req.params;

    if (!code) {
        return res.status(400).json({ success: false, message: 'Code session requis.' });
    }

    try {
        const result = await pool.query(
            `SELECT p.*, a.session_code as appt_session_code, a.appointment_date, a.appointment_time,
                    d.full_name as doctor_name, d.specialty as doctor_specialty
             FROM prescriptions p
             LEFT JOIN appointments a ON p.appointment_id = a.id
             LEFT JOIN doctors d ON p.doctor_phone = d.phone
             WHERE (a.session_code = $1 OR p.session_code = $1)
               AND p.status = 'active'
             ORDER BY p.created_at DESC
             LIMIT 1`,
            [code.toUpperCase()]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Aucune ordonnance active trouvée pour ce code.'
            });
        }

        return res.json({ success: true, data: result.rows[0] });

    } catch (error) {
        console.error('[getPrescriptionBySession] Erreur :', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── CONFIRMER DÉLIVRANCE (pharmacie) ────────────────────────────────────────
async function deliverPrescription(req, res) {
    const { prescription_id, pharmacie_phone, session_code } = req.body;

    if (!prescription_id || !pharmacie_phone) {
        return res.status(400).json({
            success: false,
            message: 'prescription_id et pharmacie_phone requis.'
        });
    }

    try {
        const check = await pool.query(
            `SELECT * FROM prescriptions WHERE id = $1`,
            [prescription_id]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Ordonnance introuvable.' });
        }

        if (check.rows[0].status === 'delivered') {
            return res.status(409).json({
                success: false,
                message: 'Cette ordonnance a déjà été délivrée — réutilisation impossible.'
            });
        }

        const result = await pool.query(
            `UPDATE prescriptions
             SET status = 'delivered',
                 pharmacie_phone = $1,
                 delivered_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [pharmacie_phone, prescription_id]
        );

        // Log audit
        await pool.query(
            `INSERT INTO audit_log (action, actor, details)
             VALUES ('prescription_delivered', $1, $2)`,
            [pharmacie_phone, JSON.stringify({ prescription_id, session_code, patient_phone: check.rows[0].patient_phone })]
        );

        console.log(`✅ Ordonnance ${prescription_id} délivrée par ${pharmacie_phone}`);

        return res.json({
            success: true,
            message: 'Délivrance confirmée.',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('[deliverPrescription] Erreur :', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── HISTORIQUE DÉLIVRANCES PAR PHARMACIE ────────────────────────────────────
async function getPrescriptionsByPharmacie(req, res) {
    const { phone } = req.params;

    try {
        const result = await pool.query(
            `SELECT p.*, a.session_code as appt_session_code, d.full_name as doctor_name
             FROM prescriptions p
             LEFT JOIN appointments a ON p.appointment_id = a.id
             LEFT JOIN doctors d ON p.doctor_phone = d.phone
             WHERE p.pharmacie_phone = $1
             ORDER BY p.delivered_at DESC
             LIMIT 50`,
            [decodeURIComponent(phone)]
        );

        return res.json({ success: true, data: result.rows });

    } catch (error) {
        console.error('[getPrescriptionsByPharmacie] Erreur :', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── ORDONNANCES D'UN PATIENT ─────────────────────────────────────────────────
async function getPrescriptionsByPatient(req, res) {
    const { phone } = req.params;

    try {
        const result = await pool.query(
            `SELECT p.*, a.session_code as appt_session_code, a.appointment_date,
                    d.full_name as doctor_name, d.specialty
             FROM prescriptions p
             LEFT JOIN appointments a ON p.appointment_id = a.id
             LEFT JOIN doctors d ON p.doctor_phone = d.phone
             WHERE p.patient_phone = $1
             ORDER BY p.created_at DESC`,
            [decodeURIComponent(phone)]
        );

        return res.json({ success: true, data: result.rows });

    } catch (error) {
        console.error('[getPrescriptionsByPatient] Erreur :', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

module.exports = {
    createPrescription,
    getPrescriptionBySession,
    deliverPrescription,
    getPrescriptionsByPharmacie,
    getPrescriptionsByPatient
};