// ============================================================
// BOLAMU — Service Pré-RDV Complet (Sprint 9)
// ============================================================
const pool = require('../config/db');
const logger = require('../config/logger');
const { calculerTriage } = require('./triage.service');
const { analyserPreRDV } = require('./amina.service');
const { notify } = require('./notification.service');

// Soumettre formulaire pré-RDV
async function soumettreFormulaire(appointment_id, patient_phone, doctor_phone, data) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { symptomes, symptomes_libres, duree_symptomes, intensite, antecedents, medicaments_actuels, allergies } = data;

        // Calculer triage
        const triageResult = calculerTriage(symptomes, intensite, duree_symptomes, antecedents);

        // INSERT pre_rdv_formulaires avec résultats triage
        const result = await client.query(`
            INSERT INTO pre_rdv_formulaires (
                appointment_id, patient_phone, doctor_phone, symptomes, symptomes_libres,
                duree_symptomes, intensite, antecedents, medicaments_actuels, allergies,
                triage_couleur, triage_score, triage_recommandation, completed_at, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
            RETURNING id
        `, [
            appointment_id, patient_phone, doctor_phone, symptomes, symptomes_libres,
            duree_symptomes, intensite, antecedents, medicaments_actuels, allergies,
            triageResult.couleur, triageResult.score, triageResult.recommandation
        ]);

        const pre_rdv_id = result.rows[0].id;

        // Audit log
        await client.query(`
            INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
            VALUES ('pre_rdv_soumis', $1, 'pre_rdv_formulaires', $2, $3)
        `, [patient_phone, pre_rdv_id, JSON.stringify({ triage_couleur: triageResult.couleur })]);

        await client.query('COMMIT');

        // Analyser via Amina (en dehors de la transaction pour ne pas bloquer)
        try {
            await analyserPreRDV(pre_rdv_id);
        } catch (aminaError) {
            logger.error('[PreRDV] Erreur analyse Amina:', aminaError.message);
        }

        // Notifications selon triage
        try {
            if (triageResult.couleur === 'rouge') {
                // Notify patient urgence + notify médecin immédiatement
                await notify(patient_phone, 'alerte_systeme', {
                    message: triageResult.recommandation
                });
                await notify(doctor_phone, 'alerte_systeme', {
                    message: `Patient ${patient_phone} : triage ROUGE - ${triageResult.recommandation}`
                });
            } else if (triageResult.couleur === 'orange') {
                // Notify médecin avec résumé
                await notify(doctor_phone, 'message_recu', {
                    message: `Patient ${patient_phone} : triage ORANGE - ${triageResult.recommandation}`
                });
            }
        } catch (notifyError) {
            logger.error('[PreRDV] Erreur notification:', notifyError.message);
        }

        logger.info('[PreRDV] Formulaire soumis', { pre_rdv_id, triage_couleur: triageResult.couleur });

        return {
            success: true,
            pre_rdv_id,
            triage: triageResult
        };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('[PreRDV] Erreur soumettreFormulaire:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// Obtenir briefing médecin
async function getBriefingMedecin(appointment_id, doctor_phone) {
    try {
        // Vérifier que doctor_phone correspond au RDV
        const rdvResult = await pool.query(`
            SELECT a.id, a.patient_phone, a.doctor_id, d.phone as doctor_phone
            FROM appointments a
            JOIN doctors d ON d.id = a.doctor_id
            WHERE a.id = $1 AND d.phone = $2 AND a.is_active = TRUE
        `, [appointment_id, doctor_phone]);

        if (rdvResult.rows.length === 0) {
            return { success: false, error: 'RDV introuvable ou accès non autorisé' };
        }

        const rdv = rdvResult.rows[0];

        // Récupérer formulaire pré-RDV
        const preRdvResult = await pool.query(`
            SELECT prf.*, u.full_name as patient_name, u.first_name, u.phone as patient_phone
            FROM pre_rdv_formulaires prf
            JOIN users u ON u.phone = prf.patient_phone
            WHERE prf.appointment_id = $1
        `, [appointment_id]);

        if (preRdvResult.rows.length === 0) {
            return { success: true, data: null, message: 'Aucun formulaire pré-RDV soumis' };
        }

        const formulaire = preRdvResult.rows[0];

        // Retourner briefing complet
        return {
            success: true,
            data: {
                patient_info: {
                    phone: formulaire.patient_phone,
                    full_name: formulaire.patient_name,
                    first_name: formulaire.first_name
                },
                symptomes: formulaire.symptomes,
                symptomes_libres: formulaire.symptomes_libres,
                duree_symptomes: formulaire.duree_symptomes,
                intensite: formulaire.intensite,
                antecedents: formulaire.antecedents,
                medicaments_actuels: formulaire.medicaments_actuels,
                allergies: formulaire.allergies,
                triage_couleur: formulaire.triage_couleur,
                triage_score: formulaire.triage_score,
                triage_recommandation: formulaire.triage_recommandation,
                ia_analyse: formulaire.ia_analyse,
                ia_questions_suggerees: formulaire.ia_questions_suggerees
            }
        };
    } catch (error) {
        logger.error('[PreRDV] Erreur getBriefingMedecin:', error.message);
        throw error;
    }
}

// Obtenir formulaire patient
async function getFormulairePatient(appointment_id, patient_phone) {
    try {
        const result = await pool.query(`
            SELECT prf.*, u.full_name as patient_name
            FROM pre_rdv_formulaires prf
            JOIN users u ON u.phone = prf.patient_phone
            WHERE prf.appointment_id = $1 AND prf.patient_phone = $2
        `, [appointment_id, patient_phone]);

        if (result.rows.length === 0) {
            return { success: false, error: 'Formulaire introuvable' };
        }

        return { success: true, data: result.rows[0] };
    } catch (error) {
        logger.error('[PreRDV] Erreur getFormulairePatient:', error.message);
        throw error;
    }
}

module.exports = {
    soumettreFormulaire,
    getBriefingMedecin,
    getFormulairePatient
};
