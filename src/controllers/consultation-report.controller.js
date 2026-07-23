const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const { awardZora, resolveConsultationActionType } = require('../services/zora.service');
const { sendAutoMessage } = require('../services/whatsapp.service');
const { normalizePhone } = require('../utils/phone');

// ─── SOUMETTRE UN COMPTE RENDU DE CONSULTATION (médecin) ─────────────────
async function submitReport(req, res) {
    const { appointment_id, patient_phone, doctor_phone, motif, observations, diagnostic, traitement, prochaine_etape } = req.body;
    const doctorPhone = req.user?.phone;

    if (!appointment_id || !patient_phone || !doctor_phone || !motif || !observations || !diagnostic) {
        return res.status(400).json({
            success: false,
            message: 'Champs obligatoires manquants : appointment_id, patient_phone, doctor_phone, motif, observations, diagnostic'
        });
    }

    try {
        // Vérifier que le RDV appartient au médecin connecté
        const rdvCheck = await pool.query(
            `SELECT a.*, d.phone as doctor_phone 
             FROM appointments a
             LEFT JOIN doctors d ON a.doctor_id = d.id
             WHERE a.id = $1`,
            [appointment_id]
        );

        if (rdvCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'RDV introuvable.' });
        }

        const rdv = rdvCheck.rows[0];
        
        // Vérifier que le médecin connecté est bien le médecin du RDV
        if (rdv.doctor_phone !== doctorPhone) {
            return res.status(403).json({ success: false, message: 'Ce RDV ne vous appartient pas.' });
        }

        // Vérifier que le statut du RDV est 'termine' ou 'en_cours'
        if (!['termine', 'en_cours', 'confirme'].includes(rdv.status)) {
            return res.status(400).json({ success: false, message: 'Statut du RDV incompatible.' });
        }

        // Insérer le rapport
        const result = await pool.query(
            `INSERT INTO consultation_reports 
                (appointment_id, patient_phone, doctor_phone, motif, observations, diagnostic, traitement, prochaine_etape)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [appointment_id, patient_phone, doctor_phone, motif, observations, diagnostic, traitement || null, prochaine_etape || null]
        );

        // Mettre à jour report_submitted = true dans appointments
        await pool.query(
            `UPDATE appointments SET report_submitted = TRUE WHERE id = $1`,
            [appointment_id]
        );

        // Créditer points Zora pour consultation (non bloquant). rdv.motif = motif du
        // RDV posé par le patient à la réservation (appointments.motif) — à ne pas
        // confondre avec le `motif` du compte rendu médecin (req.body, autre table).
        setImmediate(async () => {
            try {
                const zoraResult = await awardZora({
                    phone: patient_phone,
                    action_type: resolveConsultationActionType(rdv.motif),
                    proof_class: 'system_event',
                    proof_source: doctor_phone,
                    proof_reference: appointment_id.toString()
                });

                if (zoraResult.success) {
                    // Envoyer WhatsApp gain Zora consultation
                    const balanceResult = await pool.query(
                        `SELECT balance FROM zora_points WHERE phone = $1`,
                        [patient_phone]
                    );
                    const solde = balanceResult.rows[0]?.balance || 0;

                    const doctorResult = await pool.query(
                        `SELECT full_name FROM doctors WHERE phone = $1`,
                        [doctor_phone]
                    );
                    const medecin = doctorResult.rows[0]?.full_name || 'Dr.';

                    await sendAutoMessage(patient_phone, 'gain_zora_consultation', [
                        medecin,
                        '50',
                        solde.toString()
                    ]);
                } else {
                    // Perte silencieuse jusqu'ici (audit Zora du 12 juillet 2026) :
                    // daily_cap=1 sur 'consultation' fait qu'une 2e consultation
                    // réelle le même jour ne crédite jamais rien, sans aucune trace.
                    // Le plafond reste inchangé (anti-abus voulu) — seul le silence
                    // est corrigé ici.
                    console.error(
                        `[submitReport] Crédit Zora consultation non effectué — ` +
                        `patient_phone=${patient_phone}, appointment_id=${appointment_id}, ` +
                        `raison=${zoraResult.reason}`
                    );
                }
            } catch (zoraErr) {
                console.error('[submitReport] Erreur gain Zora (non bloquante):', zoraErr.message);
            }
        });

        return res.status(201).json({
            success: true,
            message: 'Compte rendu soumis avec succès.',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('[submitReport] Erreur :', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── RÉCUPÉRER LE COMPTE RENDU D'UN RDV ─────────────────────────────────────
async function getReportByAppointment(req, res) {
    const { id } = req.params;
    const userPhone = req.user?.phone;
    const userRole = req.user?.role;

    try {
        // Récupérer le RDV et le compte rendu
        const result = await pool.query(
            `SELECT cr.*, a.patient_phone, a.doctor_id, d.phone as doctor_phone
             FROM consultation_reports cr
             LEFT JOIN appointments a ON cr.appointment_id = a.id
             LEFT JOIN doctors d ON a.doctor_id = d.id
             WHERE cr.appointment_id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Aucun compte rendu trouvé pour ce RDV.' });
        }

        const report = result.rows[0];

        // Vérifier les droits d'accès : médecin du RDV ou patient concerné
        const isDoctor = userPhone === report.doctor_phone;
        const isPatient = userPhone === report.patient_phone;
        const isAdmin = userRole === 'admin' || userRole === 'content_admin';

        if (!isDoctor && !isPatient && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Accès refusé.' });
        }

        // Log l'accès au dossier (non bloquant)
        setImmediate(() => {
            logDossierAccess(report.patient_phone, userPhone, userRole, 'consultation_report', req.ip);
        });

        return res.json({ success: true, data: report });

    } catch (error) {
        console.error('[getReportByAppointment] Erreur :', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── RÉCUPÉRER LA TIMELINE D'UN PATIENT (RDV + comptes rendus + prescriptions + ordonnances + labo) ─────────
async function getPatientTimeline(req, res) {
    const phone = normalizePhone(req.params.phone || '');
    const userPhone = req.user?.phone;
    const userRole = req.user?.role;

    try {
        // Vérifier les droits : médecin traitant ou patient lui-même
        const isPatient = userPhone === phone;
        const isAdmin = userRole === 'admin' || userRole === 'content_admin';

        // Si c'est un médecin, vérifier qu'il a déjà eu des RDV avec ce patient
        let isTreatingDoctor = false;
        if (!isPatient && !isAdmin) {
            const doctorCheck = await pool.query(
                `SELECT COUNT(*) FROM appointments a
                 JOIN doctors d ON d.id = a.doctor_id
                 WHERE a.patient_phone = $1 AND d.phone = $2`,
                [phone, userPhone]
            );
            isTreatingDoctor = parseInt(doctorCheck.rows[0].count) > 0;
        }

        if (!isPatient && !isAdmin && !isTreatingDoctor) {
            return res.status(403).json({ success: false, message: 'Accès refusé.' });
        }

        // 1. Consultations du patient (RDV lié ou non) + dernier compte rendu + infos médecin
        const baseResult = await pool.query(
            `SELECT
                c.id as consultation_id,
                c.appointment_id,
                c.started_at,
                c.ended_at,
                c.status as consultation_status,
                a.appointment_date,
                a.appointment_time,
                a.session_code,
                a.report_submitted,
                a.status as appointment_status,
                d.phone as doctor_phone,
                d.full_name as doctor_name,
                d.specialty as doctor_specialty,
                d.photo_url as doctor_photo_url,
                cr.motif as cr_motif,
                cr.observations,
                cr.diagnostic as cr_diagnostic,
                cr.traitement,
                cr.prochaine_etape,
                cr.created_at as report_created_at
             FROM consultations c
             LEFT JOIN appointments a ON a.id = c.appointment_id
             LEFT JOIN doctors d ON d.phone = c.doctor_phone
             LEFT JOIN LATERAL (
                 SELECT * FROM consultation_reports
                 WHERE appointment_id = c.appointment_id
                 ORDER BY created_at DESC
                 LIMIT 1
             ) cr ON true
             WHERE c.patient_phone = $1
             ORDER BY COALESCE(a.appointment_date, c.started_at::date) DESC,
                      COALESCE(a.appointment_time, c.started_at::time) DESC`,
            [phone]
        );

        const appointmentIds = baseResult.rows.map(r => r.appointment_id).filter(Boolean);
        const consultationIds = baseResult.rows.map(r => r.consultation_id);

        // 2. Prescriptions (appointment_id), ordonnances legacy (consultation_id) et labo (appointment_id)
        const [prescriptionsResult, ordonnancesResult, labResult] = await Promise.all([
            appointmentIds.length ? pool.query(
                `SELECT appointment_id,
                        COALESCE(jsonb_agg(jsonb_build_object(
                            'id', id,
                            'medications', medications,
                            'instructions', instructions,
                            'status', status,
                            'is_ssp', is_ssp,
                            'created_at', created_at
                        ) ORDER BY created_at DESC), '[]'::jsonb) as items
                 FROM prescriptions
                 WHERE appointment_id = ANY($1::int[])
                 GROUP BY appointment_id`,
                [appointmentIds]
            ) : { rows: [] },
            consultationIds.length ? pool.query(
                `SELECT o.consultation_id,
                        o.id as ordonnance_id,
                        o.issued_at,
                        o.status,
                        COALESCE((
                            SELECT jsonb_agg(jsonb_build_object(
                                'medicament', oi.medicament,
                                'dosage', oi.dosage,
                                'frequence', oi.frequence,
                                'duree', oi.duree,
                                'instructions', oi.instructions,
                                'quantite', oi.quantite
                            ) ORDER BY oi.id)
                            FROM ordonnance_items oi
                            WHERE oi.ordonnance_id = o.id
                        ), '[]'::jsonb) as items
                 FROM ordonnances o
                 WHERE o.consultation_id = ANY($1::int[])`,
                [consultationIds]
            ) : { rows: [] },
            appointmentIds.length ? pool.query(
                `SELECT lp.appointment_id,
                        lp.id as lab_prescription_id,
                        lp.examens,
                        lp.instructions,
                        lp.status,
                        lp.prescription_code,
                        lp.is_ssp,
                        COALESCE((
                            SELECT jsonb_agg(jsonb_build_object(
                                'resultats', lr.resultats,
                                'fichier_url', lr.fichier_url,
                                'status', lr.status,
                                'created_at', lr.created_at
                            ) ORDER BY lr.created_at DESC)
                            FROM lab_results lr
                            WHERE lr.lab_prescription_id = lp.id
                        ), '[]'::jsonb) as results
                 FROM lab_prescriptions lp
                 WHERE lp.appointment_id = ANY($1::int[])`,
                [appointmentIds]
            ) : { rows: [] }
        ]);

        const prescriptionsMap = {};
        prescriptionsResult.rows.forEach(row => { prescriptionsMap[row.appointment_id] = row.items; });

        const ordonnancesMap = {};
        ordonnancesResult.rows.forEach(row => {
            if (!ordonnancesMap[row.consultation_id]) ordonnancesMap[row.consultation_id] = [];
            ordonnancesMap[row.consultation_id].push({
                id: row.ordonnance_id,
                issued_at: row.issued_at,
                status: row.status,
                items: row.items
            });
        });

        const labMap = {};
        labResult.rows.forEach(row => {
            if (!labMap[row.appointment_id]) labMap[row.appointment_id] = [];
            labMap[row.appointment_id].push({
                id: row.lab_prescription_id,
                examens: row.examens,
                instructions: row.instructions,
                status: row.status,
                prescription_code: row.prescription_code,
                is_ssp: row.is_ssp,
                results: row.results
            });
        });

        const data = baseResult.rows.map(r => {
            const report = r.report_created_at ? {
                motif: r.cr_motif,
                observations: r.observations,
                diagnostic: r.cr_diagnostic,
                traitement: r.traitement,
                prochaine_etape: r.prochaine_etape,
                created_at: r.report_created_at
            } : null;
            return {
                consultation_id: r.consultation_id,
                appointment_id: r.appointment_id,
                appointment_date: r.appointment_date,
                appointment_time: r.appointment_time,
                started_at: r.started_at,
                status: r.appointment_status || r.consultation_status,
                session_code: r.session_code,
                report_submitted: r.report_submitted,
                doctor_phone: r.doctor_phone,
                doctor_name: r.doctor_name,
                doctor_specialty: r.doctor_specialty,
                doctor_photo_url: r.doctor_photo_url,
                consultation_report: report,
                prescriptions: prescriptionsMap[r.appointment_id] || [],
                ordonnances: ordonnancesMap[r.consultation_id] || [],
                lab_exams: labMap[r.appointment_id] || []
            };
        });

        // Log l'accès au dossier (non bloquant)
        setImmediate(() => {
            logDossierAccess(phone, userPhone, userRole, 'timeline', req.ip);
        });

        return res.json({ success: true, data });

    } catch (error) {
        console.error('[getPatientTimeline] Erreur :', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── LOG D'ACCÈS AU DOSSIER (fonction utilitaire interne) ─────────────────────
async function logDossierAccess(patientPhone, accessorPhone, accessorRole, accessType, ip) {
    try {
        await pool.query(
            `INSERT INTO dossier_access_log (patient_phone, accessed_by_phone, accessed_by_role, access_type, ip_address)
             VALUES ($1, $2, $3, $4, $5)`,
            [patientPhone, accessorPhone, accessorRole, accessType, ip || null]
        );
    } catch (error) {
        console.error('[logDossierAccess] Erreur (non bloquante) :', error.message);
    }
}

// ─── RÉCUPÉRER L'HISTORIQUE DES ACCÈS AU DOSSIER (patient uniquement) ───────────
async function getDossierAccessLog(req, res) {
    const phone = normalizePhone(req.params.phone || '');
    const userPhone = req.user?.phone;
    const userRole = req.user?.role;

    try {
        // Seul le patient concerné peut voir son historique d'accès
        if (userPhone !== phone && userRole !== 'admin' && userRole !== 'content_admin') {
            return res.status(403).json({ success: false, message: 'Accès refusé.' });
        }

        const result = await pool.query(
            `SELECT 
                dal.*,
                u.full_name as accessor_name
             FROM dossier_access_log dal
             LEFT JOIN users u ON dal.accessed_by_phone = u.phone
             WHERE dal.patient_phone = $1
             ORDER BY dal.created_at DESC
             LIMIT 50`,
            [phone]
        );

        return res.json({ success: true, data: result.rows });

    } catch (error) {
        console.error('[getDossierAccessLog] Erreur :', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

module.exports = {
    submitReport,
    getReportByAppointment,
    getPatientTimeline,
    logDossierAccess,
    getDossierAccessLog
};
