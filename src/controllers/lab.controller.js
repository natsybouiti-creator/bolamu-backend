const pool = require('../config/db');

// ─── CRÉER UNE PRESCRIPTION LABO (médecin) ───────────────────────────────
async function createLabPrescription(req, res) {
    const { appointment_id, patient_phone, doctor_phone, lab_phone, examens, instructions } = req.body;
    const doctorPhone = req.user?.phone;

    if (!patient_phone || !doctor_phone || !examens) {
        return res.status(400).json({
            success: false,
            message: 'Champs obligatoires manquants : patient_phone, doctor_phone, examens'
        });
    }

    try {
        // Vérifier que le médecin connecté est bien celui qui prescrit
        if (doctorPhone !== doctor_phone) {
            return res.status(403).json({ success: false, message: 'Accès refusé.' });
        }

        // Générer un code de prescription unique de 6 chiffres
        const prescriptionCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Insérer la prescription labo
        const result = await pool.query(
            `INSERT INTO lab_prescriptions 
                (appointment_id, patient_phone, doctor_phone, lab_phone, examens, instructions, prescription_code)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [appointment_id || null, patient_phone, doctor_phone, lab_phone || null, examens, instructions || null, prescriptionCode]
        );

        // Notification SMS au laboratoire (optionnel - à implémenter selon besoin)
        console.log(`📋 Prescription labo créée pour patient ${patient_phone} par ${doctorPhone} - Code: ${prescriptionCode}`);

        return res.status(201).json({
            success: true,
            message: 'Prescription labo créée avec succès.',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('[createLabPrescription] Erreur :', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── DÉPOSER LES RÉSULTATS LABO (laborantin) ───────────────────────────────
async function submitLabResults(req, res) {
    const { lab_prescription_id, patient_phone, lab_phone, doctor_phone, resultats, fichier_url } = req.body;
    const labPhone = req.user?.phone;

    if (!lab_prescription_id || !patient_phone || !doctor_phone || !resultats) {
        return res.status(400).json({
            success: false,
            message: 'Champs obligatoires manquants : lab_prescription_id, patient_phone, doctor_phone, resultats'
        });
    }

    try {
        // Vérifier que la prescription existe et est en attente
        const prescCheck = await pool.query(
            `SELECT * FROM lab_prescriptions WHERE id = $1 AND status = 'en_attente'`,
            [lab_prescription_id]
        );

        if (prescCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Prescription introuvable ou non autorisée.' });
        }

        // Insérer les résultats
        const result = await pool.query(
            `INSERT INTO lab_results 
                (lab_prescription_id, patient_phone, lab_phone, doctor_phone, resultats, fichier_url)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [lab_prescription_id, patient_phone, labPhone, doctor_phone, resultats, fichier_url || null]
        );

        // Mettre à jour le statut de la prescription
        await pool.query(
            `UPDATE lab_prescriptions SET status = 'traite' WHERE id = $1`,
            [lab_prescription_id]
        );

        // Enregistrer quel labo a traité la prescription
        await pool.query(
            `UPDATE lab_prescriptions SET lab_phone = $1 WHERE id = $2`,
            [labPhone, lab_prescription_id]
        );

        console.log(`🔬 Résultats labo déposés pour patient ${patient_phone} par ${labPhone}`);

        return res.status(201).json({
            success: true,
            message: 'Résultats déposés avec succès.',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('[submitLabResults] Erreur :', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── RÉCUPÉRER LES RÉSULTATS LABO D'UN PATIENT (patient, médecin, laborantin) ───
async function getLabResultsByPatient(req, res) {
    const { phone } = req.params;
    const userPhone = req.user?.phone;
    const userRole = req.user?.role;

    try {
        // Contrôle d'accès strict
        const isPatient = userPhone === phone;
        const isAdmin = userRole === 'admin' || userRole === 'content_admin';
        
        // Si c'est un médecin, vérifier qu'il a déjà eu des RDV avec ce patient
        let isTreatingDoctor = false;
        if (!isPatient && !isAdmin) {
            const doctorCheck = await pool.query(
                `SELECT COUNT(*) FROM appointments 
                 WHERE patient_phone = $1 AND doctor_id = (SELECT id FROM doctors WHERE phone = $2)`,
                [phone, userPhone]
            );
            isTreatingDoctor = parseInt(doctorCheck.rows[0].count) > 0;
        }

        // Si c'est un laborantin, vérifier qu'il a traité des prescriptions pour ce patient
        let isTreatingLab = false;
        if (!isPatient && !isAdmin && !isTreatingDoctor) {
            const labCheck = await pool.query(
                `SELECT COUNT(*) FROM lab_results 
                 WHERE patient_phone = $1 AND lab_phone = $2`,
                [phone, userPhone]
            );
            isTreatingLab = parseInt(labCheck.rows[0].count) > 0;
        }

        if (!isPatient && !isAdmin && !isTreatingDoctor && !isTreatingLab) {
            return res.status(403).json({ success: false, message: 'Accès refusé.' });
        }

        // Récupérer tous les résultats labo du patient
        const result = await pool.query(
            `SELECT 
                lr.*,
                lp.examens,
                lp.instructions as prescription_instructions,
                d.full_name as doctor_name,
                d.specialty,
                l.name as lab_name
             FROM lab_results lr
             LEFT JOIN lab_prescriptions lp ON lr.lab_prescription_id = lp.id
             LEFT JOIN doctors d ON lr.doctor_phone = d.phone
             LEFT JOIN laboratories l ON lr.lab_phone = l.phone
             WHERE lr.patient_phone = $1
             ORDER BY lr.created_at DESC`,
            [phone]
        );

        return res.json({ success: true, data: result.rows });

    } catch (error) {
        console.error('[getLabResultsByPatient] Erreur :', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── RÉCUPÉRER LES PRESCRIPTIONS EN ATTENTE POUR UN LABO (laborantin uniquement) ─
async function getLabResultsForLab(req, res) {
    const labPhone = req.user?.phone;

    try {
        // Contrôle d'accès : uniquement le laborantin connecté peut voir les prescriptions
        if (!labPhone) {
            return res.status(401).json({ success: false, message: 'Non authentifié.' });
        }

        // Récupérer TOUTES les prescriptions en attente (sans filtre par lab_phone)
        const result = await pool.query(
            `SELECT 
                lp.*,
                d.full_name as doctor_name,
                d.specialty,
                a.appointment_date,
                a.appointment_time
             FROM lab_prescriptions lp
             LEFT JOIN doctors d ON lp.doctor_phone = d.phone
             LEFT JOIN appointments a ON lp.appointment_id = a.id
             WHERE lp.status = 'en_attente'
             ORDER BY lp.created_at DESC`
        );

        return res.json({ success: true, data: result.rows });

    } catch (error) {
        console.error('[getLabResultsForLab] Erreur :', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── RÉCUPÉRER UNE PRESCRIPTION PAR CODE (laborantin authentifié) ─
async function getLabPrescriptionByCode(req, res) {
    const { code } = req.params;
    const labPhone = req.user?.phone;
    console.log('[DEBUG getLabPrescriptionByCode] code reçu:', code);
    console.log('[DEBUG getLabPrescriptionByCode] labPhone:', labPhone);

    if (!labPhone) {
        return res.status(401).json({ success: false, message: 'Non authentifié.' });
    }

    try {
        // Récupérer la prescription par code
        const result = await pool.query(
            `SELECT 
                lp.*,
                d.full_name as doctor_name,
                d.specialty,
                a.appointment_date,
                a.appointment_time
             FROM lab_prescriptions lp
             LEFT JOIN doctors d ON lp.doctor_phone = d.phone
             LEFT JOIN appointments a ON lp.appointment_id = a.id
             WHERE lp.prescription_code = $1`,
            [code]
        );
        console.log('[DEBUG getLabPrescriptionByCode] rows trouvées:', result.rows.length);

        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: 'Prescription introuvable.' });
        }

        const prescription = result.rows[0];

        // Logger l'accès dans dossier_access_log
        setImmediate(() => {
            pool.query(
                `INSERT INTO dossier_access_log (patient_phone, accessed_by_phone, accessed_by_role, access_type, created_at)
                 VALUES ($1, $2, 'laboratoire', 'lab_code', NOW())`,
                [prescription.patient_phone, labPhone]
            ).catch(() => {});
        });

        return res.json({ success: true, data: prescription });

    } catch (error) {
        console.error('[getLabPrescriptionByCode] Erreur :', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

module.exports = {
    createLabPrescription,
    submitLabResults,
    getLabResultsByPatient,
    getLabResultsForLab,
    getLabPrescriptionByCode
};
