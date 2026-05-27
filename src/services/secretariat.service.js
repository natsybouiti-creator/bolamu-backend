// ============================================================
// BOLAMU — Service Secrétariat (Sprint 8)
// ============================================================
const pool = require('../config/db');
const logger = require('../config/logger');
const { notify } = require('./notification.service');

// Ajouter patient en file d'attente
async function ajouterFileAttente(partenaire_phone, patient_phone, doctor_phone, motif, priorite, secretaire_phone) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Calculer numero_ordre = MAX(numero_ordre) + 1 pour ce partenaire aujourd'hui
        const ordreResult = await client.query(`
            SELECT COALESCE(MAX(numero_ordre), 0) as max_ordre
            FROM file_attente
            WHERE partenaire_phone = $1 AND DATE(heure_arrivee) = CURRENT_DATE
        `, [partenaire_phone]);
        const numero_ordre = parseInt(ordreResult.rows[0].max_ordre) + 1;

        // INSERT file_attente
        const result = await client.query(`
            INSERT INTO file_attente (partenaire_phone, patient_phone, doctor_phone, motif, priorite, statut, numero_ordre, heure_arrivee, created_by)
            VALUES ($1, $2, $3, $4, $5, 'en_attente', $6, NOW(), $7)
            RETURNING id, numero_ordre
        `, [partenaire_phone, patient_phone, doctor_phone, motif, priorite, numero_ordre, secretaire_phone]);

        // Audit log
        await client.query(`
            INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
            VALUES ('file_attente_ajoutee', $1, 'file_attente', $2, $3)
        `, [secretaire_phone, result.rows[0].id, JSON.stringify({ patient_phone, doctor_phone, priorite })]);

        await client.query('COMMIT');

        // Notify patient
        try {
            await notify(patient_phone, 'message_recu', {
                message: `Vous êtes en file d'attente, position ${numero_ordre}`
            });
        } catch (notifyErr) {
            logger.error('[Secretariat] Erreur notification:', notifyErr.message);
        }

        logger.info('[Secretariat] Patient ajouté en file d attente', { patient_phone, numero_ordre });
        return { success: true, id: result.rows[0].id, numero_ordre };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('[Secretariat] Erreur ajouterFileAttente:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// Appeler le patient suivant
async function appellerPatient(file_attente_id, secretaire_phone) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // UPDATE statut = 'en_consultation' + heure_appel = NOW()
        const result = await client.query(`
            UPDATE file_attente
            SET statut = 'en_consultation', heure_appel = NOW()
            WHERE id = $1 AND statut = 'en_attente'
            RETURNING patient_phone, doctor_phone
        `, [file_attente_id]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            throw new Error('File d attente introuvable ou déjà appelée');
        }

        const patient_phone = result.rows[0].patient_phone;
        const doctor_phone = result.rows[0].doctor_phone;

        // Audit log
        await client.query(`
            INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
            VALUES ('patient_appelle', $1, 'file_attente', $2, $3)
        `, [secretaire_phone, file_attente_id, JSON.stringify({ patient_phone })]);

        await client.query('COMMIT');

        // Notify patient
        try {
            await notify(patient_phone, 'message_recu', {
                message: "C'est votre tour"
            });
        } catch (notifyErr) {
            logger.error('[Secretariat] Erreur notification:', notifyErr.message);
        }

        logger.info('[Secretariat] Patient appelé', { file_attente_id, patient_phone });
        return { success: true, patient_phone };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('[Secretariat] Erreur appellerPatient:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// Terminer consultation
async function terminerConsultation(file_attente_id, secretaire_phone) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // UPDATE statut = 'termine' + heure_fin = NOW()
        const result = await client.query(`
            UPDATE file_attente
            SET statut = 'termine', heure_fin = NOW()
            WHERE id = $1 AND statut = 'en_consultation'
            RETURNING patient_phone
        `, [file_attente_id]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            throw new Error('File d attente introuvable ou déjà terminée');
        }

        const patient_phone = result.rows[0].patient_phone;

        // Audit log
        await client.query(`
            INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
            VALUES ('consultation_terminee', $1, 'file_attente', $2, $3)
        `, [secretaire_phone, file_attente_id, JSON.stringify({ patient_phone })]);

        await client.query('COMMIT');

        // Notify patient
        try {
            await notify(patient_phone, 'message_recu', {
                message: "Consultation terminée"
            });
        } catch (notifyErr) {
            logger.error('[Secretariat] Erreur notification:', notifyErr.message);
        }

        logger.info('[Secretariat] Consultation terminée', { file_attente_id, patient_phone });
        return { success: true, patient_phone };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('[Secretariat] Erreur terminerConsultation:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// Obtenir file d'attente du jour
async function getFileAttente(partenaire_phone) {
    try {
        const result = await pool.query(`
            SELECT fa.id, fa.patient_phone, fa.doctor_phone, fa.motif, fa.priorite, fa.statut, 
                   fa.numero_ordre, fa.heure_arrivee, fa.heure_appel, fa.heure_fin, fa.notes,
                   u.full_name as patient_name, u.first_name
            FROM file_attente fa
            JOIN users u ON u.phone = fa.patient_phone
            WHERE fa.partenaire_phone = $1 
              AND DATE(fa.heure_arrivee) = CURRENT_DATE
              AND fa.statut IN ('en_attente', 'en_consultation')
            ORDER BY 
              CASE fa.priorite
                WHEN 'critique' THEN 1
                WHEN 'urgente' THEN 2
                WHEN 'normale' THEN 3
              END,
              fa.numero_ordre ASC
        `, [partenaire_phone]);

        // Calculer temps d'attente estimé pour chaque patient
        const fileAvecTemps = result.rows.map(row => {
            const tempsAttente = Date.now() - new Date(row.heure_arrivee).getTime();
            return {
                ...row,
                temps_attente_minutes: Math.floor(tempsAttente / 60000)
            };
        });

        return { success: true, data: fileAvecTemps };
    } catch (error) {
        logger.error('[Secretariat] Erreur getFileAttente:', error.message);
        throw error;
    }
}

// Bloquer créneau agenda
async function bloquerAgenda(doctor_phone, date, heure_debut, heure_fin, type, motif, secretaire_phone) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Vérifier pas de conflit avec RDV existants
        const conflitResult = await client.query(`
            SELECT id, patient_phone, appointment_date, appointment_time
            FROM appointments
            WHERE doctor_id = (SELECT id FROM doctors WHERE phone = $1)
              AND appointment_date = $2
              AND appointment_time BETWEEN $3 AND $4
              AND is_active = TRUE
        `, [doctor_phone, date, heure_debut, heure_fin]);

        if (conflitResult.rows.length > 0) {
            await client.query('ROLLBACK');
            throw new Error(`Conflit avec ${conflitResult.rows.length} RDV existants`);
        }

        // INSERT agenda_blocs
        await client.query(`
            INSERT INTO agenda_blocs (doctor_phone, date, heure_debut, heure_fin, type, motif_blocage, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [doctor_phone, date, heure_debut, heure_fin, type, motif, secretaire_phone]);

        // Audit log
        await client.query(`
            INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
            VALUES ('agenda_bloque', $1, 'agenda_blocs', NULL, $2)
        `, [secretaire_phone, JSON.stringify({ doctor_phone, date, heure_debut, heure_fin, type })]);

        await client.query('COMMIT');

        logger.info('[Secretariat] Agenda bloqué', { doctor_phone, date, type });
        return { success: true };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('[Secretariat] Erreur bloquerAgenda:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// Obtenir agenda du jour
async function getAgendaJour(doctor_phone, date) {
    try {
        // RDV confirmés
        const rdvResult = await pool.query(`
            SELECT id, patient_phone, appointment_date, appointment_time, session_code
            FROM appointments
            WHERE doctor_id = (SELECT id FROM doctors WHERE phone = $1)
              AND appointment_date = $2
              AND status = 'confirme'
              AND is_active = TRUE
            ORDER BY appointment_time
        `, [doctor_phone, date]);

        // Blocs agenda
        const blocsResult = await pool.query(`
            SELECT id, heure_debut, heure_fin, type, motif_blocage
            FROM agenda_blocs
            WHERE doctor_phone = $1 AND date = $2
            ORDER BY heure_debut
        `, [doctor_phone, date]);

        // Générer timeline 8h-20h
        const timeline = [];
        for (let heure = 8; heure < 20; heure++) {
            const heureStr = `${heure.toString().padStart(2, '0')}:00`;
            
            // Vérifier si créneau bloqué
            const bloc = blocsResult.rows.find(b => {
                const debut = parseInt(b.heure_debut.split(':')[0]);
                const fin = parseInt(b.heure_fin.split(':')[0]);
                return heure >= debut && heure < fin;
            });

            // Vérifier si RDV à cette heure
            const rdv = rdvResult.rows.find(r => r.appointment_time.startsWith(heureStr));

            timeline.push({
                heure: heureStr,
                type: bloc ? bloc.type : (rdv ? 'rdv' : 'disponible'),
                motif: bloc ? bloc.motif_blocage : (rdv ? 'RDV confirmé' : null),
                rdv_id: rdv ? rdv.id : null
            });
        }

        return { success: true, data: { rdv: rdvResult.rows, blocs: blocsResult.rows, timeline } };
    } catch (error) {
        logger.error('[Secretariat] Erreur getAgendaJour:', error.message);
        throw error;
    }
}

// Annuler RDV (soft delete)
async function annulerRDV(rdv_id, secretaire_phone, motif) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Soft delete sur appointment (is_active = false)
        const result = await client.query(`
            UPDATE appointments
            SET is_active = FALSE, updated_at = NOW()
            WHERE id = $1 AND is_active = TRUE
            RETURNING patient_phone, doctor_id
        `, [rdv_id]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            throw new Error('RDV introuvable ou déjà annulé');
        }

        const patient_phone = result.rows[0].patient_phone;
        const doctor_id = result.rows[0].doctor_id;

        // Récupérer doctor_phone
        const doctorResult = await client.query(`
            SELECT phone FROM doctors WHERE id = $1
        `, [doctor_id]);
        const doctor_phone = doctorResult.rows[0]?.phone;

        // Audit log
        await client.query(`
            INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
            VALUES ('rdv_annule', $1, 'appointments', $2, $3)
        `, [secretaire_phone, rdv_id, JSON.stringify({ motif })]);

        await client.query('COMMIT');

        // Notify patient + médecin
        try {
            await notify(patient_phone, 'rdv_annule', { motif });
            if (doctor_phone) {
                await notify(doctor_phone, 'rdv_annule', { motif });
            }
        } catch (notifyErr) {
            logger.error('[Secretariat] Erreur notification:', notifyErr.message);
        }

        logger.info('[Secretariat] RDV annulé', { rdv_id, patient_phone });
        return { success: true, patient_phone };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('[Secretariat] Erreur annulerRDV:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// Stats dashboard secrétariat
async function getDashboardStats(partenaire_phone) {
    try {
        const today = new Date().toISOString().split('T')[0];

        // Nb patients aujourd'hui
        const patientsResult = await pool.query(`
            SELECT COUNT(*) as count
            FROM file_attente
            WHERE partenaire_phone = $1 AND DATE(heure_arrivee) = CURRENT_DATE
        `, [partenaire_phone]);

        // Temps moyen consultation
        const tempsResult = await pool.query(`
            SELECT AVG(EXTRACT(EPOCH FROM (heure_fin - heure_appel)) / 60) as avg_minutes
            FROM file_attente
            WHERE partenaire_phone = $1 
              AND DATE(heure_arrivee) = CURRENT_DATE
              AND statut = 'termine'
              AND heure_fin IS NOT NULL
        `, [partenaire_phone]);

        // RDV à venir
        const rdvResult = await pool.query(`
            SELECT COUNT(*) as count
            FROM appointments
            WHERE doctor_id IN (SELECT id FROM doctors WHERE phone IN (
              SELECT phone FROM secretaires WHERE partenaire_phone = $1
            ))
              AND appointment_date >= $2
              AND is_active = TRUE
        `, [partenaire_phone, today]);

        return {
            success: true,
            data: {
                patients_aujourdhui: parseInt(patientsResult.rows[0].count),
                temps_moyen_consultation: parseFloat(tempsResult.rows[0].avg_minutes || 0),
                rdv_avenir: parseInt(rdvResult.rows[0].count)
            }
        };
    } catch (error) {
        logger.error('[Secretariat] Erreur getDashboardStats:', error.message);
        throw error;
    }
}

module.exports = {
    ajouterFileAttente,
    appellerPatient,
    terminerConsultation,
    getFileAttente,
    bloquerAgenda,
    getAgendaJour,
    annulerRDV,
    getDashboardStats
};
