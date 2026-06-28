// ============================================================
// BOLAMU — Routes Pré-RDV (Sprint 9)
// ============================================================
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const {
    soumettreFormulaireController,
    getBriefingMedecinController,
    getFormulairePatientController,
    startAiSessionController,
    sendAiMessageController,
    getAiSessionController
} = require('../controllers/preRdv.controller');
const {
    demanderRenouvellement,
    validerRenouvellement,
    refuserRenouvellement,
    listerDemandes
} = require('../services/renouvellement.service');

// Middleware RBAC : patient uniquement
const patientOnly = async (req, res, next) => {
    if (req.user.role !== 'patient') {
        return res.status(403).json({ success: false, message: 'Accès réservé aux patients' });
    }
    next();
};

// Middleware RBAC : doctor uniquement
const doctorOnly = async (req, res, next) => {
    if (req.user.role !== 'doctor') {
        return res.status(403).json({ success: false, message: 'Accès réservé aux médecins' });
    }
    next();
};

// ============================================================
// 1. FORMULAIRE PRÉ-RDV
// ============================================================

// POST /api/v1/pre-rdv/:appointment_id
// Soumettre formulaire pré-RDV (patient)
router.post('/:appointment_id', authMiddleware, patientOnly, soumettreFormulaireController);

// GET /api/v1/pre-rdv/:appointment_id/patient
// Récupérer son formulaire (patient)
router.get('/:appointment_id/patient', authMiddleware, patientOnly, getFormulairePatientController);

// GET /api/v1/pre-rdv/:appointment_id/briefing
// Briefing médecin avant consultation (doctor)
router.get('/:appointment_id/briefing', authMiddleware, doctorOnly, getBriefingMedecinController);

// ============================================================
// 2. AI CONSULT AMINA
// ============================================================

// POST /api/v1/ai/session
// Démarrer session Amina (patient)
router.post('/ai/session', authMiddleware, patientOnly, startAiSessionController);

// POST /api/v1/ai/session/:session_id/message
// Envoyer message à Amina (patient)
router.post('/ai/session/:session_id/message', authMiddleware, patientOnly, sendAiMessageController);

// GET /api/v1/ai/session/:session_id
// Récupérer historique session (patient)
router.get('/ai/session/:session_id', authMiddleware, patientOnly, getAiSessionController);

// ============================================================
// 3. RENOUVELLEMENT ASSISTÉ (Sprint 9)
// ============================================================

// POST /api/v1/renouvellement
// Demander renouvellement (patient)
router.post('/renouvellement', authMiddleware, patientOnly, async (req, res) => {
    try {
        const { prescription_id, session_id_amina } = req.body;
        const patient_phone = req.user.phone;

        const result = await demanderRenouvellement(patient_phone, prescription_id, session_id_amina);
        if (result && result.success) {
            res.json({ success: true, data: result.data || result, message: result.message || '' });
        } else {
            res.status(400).json({ success: false, error: { code: result && result.code || 'ERROR', message: result && result.message || 'Erreur.' } });
        }
    } catch (error) {
        console.error('[Renouvellement] Erreur demande:', error.message);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// PATCH /api/v1/renouvellement/:id/valider
// Valider renouvellement (doctor)
router.patch('/renouvellement/:id/valider', authMiddleware, doctorOnly, async (req, res) => {
    try {
        const { id } = req.params;
        const doctor_phone = req.user.phone;

        const result = await validerRenouvellement(id, doctor_phone);
        if (result && result.success) {
            res.json({ success: true, data: result.data || result, message: result.message || '' });
        } else {
            res.status(400).json({ success: false, error: { code: result && result.code || 'ERROR', message: result && result.message || 'Erreur.' } });
        }
    } catch (error) {
        console.error('[Renouvellement] Erreur validation:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

// PATCH /api/v1/renouvellement/:id/refuser
// Refuser renouvellement (doctor)
router.patch('/renouvellement/:id/refuser', authMiddleware, doctorOnly, async (req, res) => {
    try {
        const { id } = req.params;
        const { motif_refus } = req.body;
        const doctor_phone = req.user.phone;

        const result = await refuserRenouvellement(id, doctor_phone, motif_refus);
        if (result && result.success) {
            res.json({ success: true, data: result.data || result, message: result.message || '' });
        } else {
            res.status(400).json({ success: false, error: { code: result && result.code || 'ERROR', message: result && result.message || 'Erreur.' } });
        }
    } catch (error) {
        console.error('[Renouvellement] Erreur refus:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/v1/renouvellement
// Liste demandes (patient voit les siennes, doctor voit celles à traiter)
router.get('/renouvellement', authMiddleware, async (req, res) => {
    try {
        const user_phone = req.user.phone;
        const user_role = req.user.role;

        const result = await listerDemandes(user_phone, user_role);
        if (result && result.success) {
            res.json({ success: true, data: result.data || result, message: result.message || '' });
        } else {
            res.status(400).json({ success: false, error: { code: result && result.code || 'ERROR', message: result && result.message || 'Erreur.' } });
        }
    } catch (error) {
        console.error('[Renouvellement] Erreur liste:', error.message);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

module.exports = router;
