// ============================================================
// BOLAMU — Controller Pré-RDV (Sprint 9)
// ============================================================
const pool = require('../config/db');
const {
    soumettreFormulaire,
    getBriefingMedecin,
    getFormulairePatient
} = require('../services/preRdv.service');
const {
    startSession,
    sendMessage,
    getSession
} = require('../services/amina.service');

// Soumettre formulaire pré-RDV
async function soumettreFormulaireController(req, res) {
    try {
        const { appointment_id } = req.params;
        const patient_phone = req.user.phone;

        // Récupérer doctor_phone depuis appointment
        const rdvResult = await pool.query(`
            SELECT d.phone as doctor_phone
            FROM appointments a
            JOIN doctors d ON d.id = a.doctor_id
            WHERE a.id = $1 AND a.patient_phone = $2 AND a.is_active = TRUE
        `, [appointment_id, patient_phone]);

        if (rdvResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'RDV introuvable' });
        }

        const doctor_phone = rdvResult.rows[0].doctor_phone;

        const result = await soumettreFormulaire(appointment_id, patient_phone, doctor_phone, req.body);
        res.json(result);
    } catch (error) {
        console.error('[PreRDV] Erreur soumettreFormulaire:', error.message);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
}

// Obtenir briefing médecin
async function getBriefingMedecinController(req, res) {
    try {
        const { appointment_id } = req.params;
        const doctor_phone = req.user.phone;

        const result = await getBriefingMedecin(appointment_id, doctor_phone);
        res.json(result);
    } catch (error) {
        console.error('[PreRDV] Erreur getBriefingMedecin:', error.message);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
}

// Obtenir formulaire patient
async function getFormulairePatientController(req, res) {
    try {
        const { appointment_id } = req.params;
        const patient_phone = req.user.phone;

        const result = await getFormulairePatient(appointment_id, patient_phone);
        res.json(result);
    } catch (error) {
        console.error('[PreRDV] Erreur getFormulairePatient:', error.message);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
}

// Démarrer session Amina
async function startAiSessionController(req, res) {
    try {
        const { session_type } = req.body;
        const patient_phone = req.user.phone;

        const result = await startSession(patient_phone, session_type || 'symptomes');
        res.json(result);
    } catch (error) {
        console.error('[Amina] Erreur startAiSession:', error.message);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
}

// Envoyer message à Amina
async function sendAiMessageController(req, res) {
    try {
        const { session_id } = req.params;
        const { message } = req.body;
        const patient_phone = req.user.phone;

        const result = await sendMessage(session_id, patient_phone, message);
        res.json(result);
    } catch (error) {
        console.error('[Amina] Erreur sendAiMessage:', error.message);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
}

// Récupérer session Amina
async function getAiSessionController(req, res) {
    try {
        const { session_id } = req.params;
        const patient_phone = req.user.phone;

        const result = await getSession(session_id, patient_phone);
        res.json(result);
    } catch (error) {
        console.error('[Amina] Erreur getAiSession:', error.message);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
}

module.exports = {
    soumettreFormulaireController,
    getBriefingMedecinController,
    getFormulairePatientController,
    startAiSessionController,
    sendAiMessageController,
    getAiSessionController
};
