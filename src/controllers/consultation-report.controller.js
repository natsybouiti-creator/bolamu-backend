const pool = require('../config/db');
const jwt = require('jsonwebtoken');

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

// ─── RÉCUPÉRER LA TIMELINE D'UN PATIENT (RDV + comptes rendus + prescriptions) ─────────
async function getPatientTimeline(req, res) {
    const { phone } = req.params;
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
                `SELECT COUNT(*) FROM appointments 
                 WHERE patient_phone = $1 AND doctor_id = (SELECT id FROM doctors WHERE phone = $2)`,
                [phone, userPhone]
            );
            isTreatingDoctor = parseInt(doctorCheck.rows[0].count) > 0;
        }

        if (!isPatient && !isAdmin && !isTreatingDoctor) {
            return res.status(403).json({ success: false, message: 'Accès refusé.' });
        }

        // Récupérer tous les RDV du patient avec leurs comptes rendus, prescriptions et résultats labo
        const result = await pool.query(
            `SELECT 
                a.id as appointment_id,
                a.appointment_date,
                a.appointment_time,
                a.status,
                a.session_code,
                a.report_submitted,
                cr.motif,
                cr.observations,
                cr.diagnostic,
                cr.traitement,
                cr.prochaine_etape,
                p.medications,
                p.instructions as prescription_instructions,
                p.status as prescription_status,
                d.full_name as doctor_name,
                d.specialty,
                lr.resultats,
                lr.fichier_url,
                lr.status as lab_status,
                lr.created_at as lab_created_at
             FROM appointments a
             LEFT JOIN consultation_reports cr ON a.id = cr.appointment_id
             LEFT JOIN prescriptions p ON a.id = p.appointment_id
             LEFT JOIN doctors d ON a.doctor_id = d.id
             LEFT JOIN lab_prescriptions lp ON a.id = lp.appointment_id
             LEFT JOIN lab_results lr ON lp.id = lr.lab_prescription_id
             WHERE a.patient_phone = $1
             ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
            [phone]
        );

        // Log l'accès au dossier (non bloquant)
        setImmediate(() => {
            logDossierAccess(phone, userPhone, userRole, 'timeline', req.ip);
        });

        return res.json({ success: true, data: result.rows });

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
    const { phone } = req.params;
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
