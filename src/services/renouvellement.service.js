// ============================================================
// BOLAMU — Service Renouvellement Assisté (Sprint 9)
// ============================================================
const pool = require('../config/db');
const logger = require('../config/logger');
const { notify } = require('./notification.service');

// Demander renouvellement
async function demanderRenouvellement(patient_phone, prescription_id, session_id_amina) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Vérifier que la prescription appartient au patient
        const prescriptionResult = await client.query(`
            SELECT id, patient_phone, doctor_id, renouvellable
            FROM lab_prescriptions
            WHERE id = $1 AND patient_phone = $2 AND is_active = TRUE
        `, [prescription_id, patient_phone]);

        if (prescriptionResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return { success: false, error: 'Prescription introuvable ou non autorisée' };
        }

        const prescription = prescriptionResult.rows[0];

        // Vérifier que la prescription est renouvelable
        if (!prescription.renouvellable) {
            await client.query('ROLLBACK');
            return { success: false, error: 'Cette prescription n\'est pas renouvelable' };
        }

        // Créer demande de renouvellement
        const result = await client.query(`
            INSERT INTO renouvellement_demandes (patient_phone, prescription_id, session_id_amina, statut, created_at, updated_at)
            VALUES ($1, $2, $3, 'en_attente', NOW(), NOW())
            RETURNING id
        `, [patient_phone, prescription_id, session_id_amina]);

        const demande_id = result.rows[0].id;

        // Récupérer doctor_phone
        const doctorResult = await client.query(`
            SELECT phone FROM doctors WHERE id = $1
        `, [prescription.doctor_id]);
        const doctor_phone = doctorResult.rows[0]?.phone;

        // Audit log
        await client.query(`
            INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
            VALUES ('renouvellement_demande', $1, 'renouvellement_demandes', $2, $3)
        `, [patient_phone, demande_id, JSON.stringify({ prescription_id })]);

        await client.query('COMMIT');

        // Notify médecin prescripteur
        try {
            if (doctor_phone) {
                await notify(doctor_phone, 'message_recu', {
                    message: `Demande de renouvellement prescription #${prescription_id} du patient ${patient_phone}`
                });
            }
        } catch (notifyError) {
            logger.error('[Renouvellement] Erreur notification médecin:', notifyError.message);
        }

        logger.info('[Renouvellement] Demande créée', { demande_id, patient_phone, prescription_id });

        return {
            success: true,
            demande_id,
            statut: 'en_attente'
        };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('[Renouvellement] Erreur demanderRenouvellement:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// Valider renouvellement
async function validerRenouvellement(demande_id, doctor_phone) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Récupérer demande
        const demandeResult = await client.query(`
            SELECT rd.id, rd.patient_phone, rd.prescription_id, lp.doctor_id, lp.medicaments, lp.dosage
            FROM renouvellement_demandes rd
            JOIN lab_prescriptions lp ON lp.id = rd.prescription_id
            WHERE rd.id = $1 AND rd.statut = 'en_attente'
        `, [demande_id]);

        if (demandeResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return { success: false, error: 'Demande introuvable ou déjà traitée' };
        }

        const demande = demandeResult.rows[0];

        // Vérifier que le médecin est le prescripteur
        const doctorResult = await client.query(`
            SELECT phone FROM doctors WHERE id = $1
        `, [demande.doctor_id]);
        const prescripteur_phone = doctorResult.rows[0]?.phone;

        if (prescripteur_phone !== doctor_phone) {
            await client.query('ROLLBACK');
            return { success: false, error: 'Vous n\'êtes pas le prescripteur de cette ordonnance' };
        }

        // UPDATE statut = 'valide'
        await client.query(`
            UPDATE renouvellement_demandes
            SET statut = 'valide', doctor_phone = $1, updated_at = NOW()
            WHERE id = $2
        `, [doctor_phone, demande_id]);

        // Créer nouvelle prescription (copie de l'ancienne)
        const newPrescriptionResult = await client.query(`
            INSERT INTO lab_prescriptions (patient_phone, doctor_id, medicaments, dosage, renouvellable, is_active, created_at)
            VALUES ($1, $2, $3, $4, TRUE, TRUE, NOW())
            RETURNING id
        `, [demande.patient_phone, demande.doctor_id, demande.medicaments, demande.dosage]);

        const new_prescription_id = newPrescriptionResult.rows[0].id;

        // Audit log
        await client.query(`
            INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
            VALUES ('renouvellement_valide', $1, 'lab_prescriptions', $2, $3)
        `, [doctor_phone, new_prescription_id, JSON.stringify({ demande_id })]);

        await client.query('COMMIT');

        // Notify patient
        try {
            await notify(demande.patient_phone, 'message_recu', {
                message: 'Votre renouvellement est validé. Nouvelle prescription créée.'
            });
        } catch (notifyError) {
            logger.error('[Renouvellement] Erreur notification patient:', notifyError.message);
        }

        logger.info('[Renouvellement] Demande validée', { demande_id, new_prescription_id });

        return {
            success: true,
            new_prescription_id
        };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('[Renouvellement] Erreur validerRenouvellement:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// Refuser renouvellement
async function refuserRenouvellement(demande_id, doctor_phone, motif_refus) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Récupérer demande
        const demandeResult = await client.query(`
            SELECT rd.id, rd.patient_phone, rd.prescription_id, lp.doctor_id
            FROM renouvellement_demandes rd
            JOIN lab_prescriptions lp ON lp.id = rd.prescription_id
            WHERE rd.id = $1 AND rd.statut = 'en_attente'
        `, [demande_id]);

        if (demandeResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return { success: false, error: 'Demande introuvable ou déjà traitée' };
        }

        const demande = demandeResult.rows[0];

        // Vérifier que le médecin est le prescripteur
        const doctorResult = await client.query(`
            SELECT phone FROM doctors WHERE id = $1
        `, [demande.doctor_id]);
        const prescripteur_phone = doctorResult.rows[0]?.phone;

        if (prescripteur_phone !== doctor_phone) {
            await client.query('ROLLBACK');
            return { success: false, error: 'Vous n\'êtes pas le prescripteur de cette ordonnance' };
        }

        // UPDATE statut = 'refuse'
        await client.query(`
            UPDATE renouvellement_demandes
            SET statut = 'refuse', motif_refus = $1, doctor_phone = $2, updated_at = NOW()
            WHERE id = $3
        `, [motif_refus, doctor_phone, demande_id]);

        // Audit log
        await client.query(`
            INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
            VALUES ('renouvellement_refuse', $1, 'renouvellement_demandes', $2, $3)
        `, [doctor_phone, demande_id, JSON.stringify({ motif_refus })]);

        await client.query('COMMIT');

        // Notify patient
        try {
            await notify(demande.patient_phone, 'message_recu', {
                message: 'Votre demande de renouvellement a été refusée. Contactez votre médecin.'
            });
        } catch (notifyError) {
            logger.error('[Renouvellement] Erreur notification patient:', notifyError.message);
        }

        logger.info('[Renouvellement] Demande refusée', { demande_id, motif_refus });

        return { success: true };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('[Renouvellement] Erreur refuserRenouvellement:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// Lister demandes
async function listerDemandes(user_phone, user_role) {
    try {
        let query = '';
        let params = [];

        if (user_role === 'patient') {
            // Patient voit ses demandes
            query = `
                SELECT rd.id, rd.prescription_id, rd.statut, rd.motif_refus, rd.created_at,
                       lp.medicaments, lp.dosage
                FROM renouvellement_demandes rd
                JOIN lab_prescriptions lp ON lp.id = rd.prescription_id
                WHERE rd.patient_phone = $1
                ORDER BY rd.created_at DESC
            `;
            params = [user_phone];
        } else if (user_role === 'doctor') {
            // Médecin voit les demandes à traiter (de ses prescriptions)
            query = `
                SELECT rd.id, rd.patient_phone, rd.prescription_id, rd.statut, rd.motif_refus, rd.created_at,
                       lp.medicaments, lp.dosage, u.full_name as patient_name
                FROM renouvellement_demandes rd
                JOIN lab_prescriptions lp ON lp.id = rd.prescription_id
                JOIN users u ON u.phone = rd.patient_phone
                WHERE lp.doctor_id = (SELECT id FROM doctors WHERE phone = $1)
                  AND rd.statut = 'en_attente'
                ORDER BY rd.created_at DESC
            `;
            params = [user_phone];
        } else {
            return { success: false, error: 'Role non autorisé' };
        }

        const result = await pool.query(query, params);

        return {
            success: true,
            data: result.rows
        };
    } catch (error) {
        logger.error('[Renouvellement] Erreur listerDemandes:', error.message);
        throw error;
    }
}

module.exports = {
    demanderRenouvellement,
    validerRenouvellement,
    refuserRenouvellement,
    listerDemandes
};
