const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');

const {
    submitReport,
    getReportByAppointment,
    getPatientTimeline,
    getDossierAccessLog
} = require('../controllers/consultation-report.controller');

// Middleware pour restreindre aux médecins
const doctorOnly = (req, res, next) => {
    if (req.user?.role !== 'doctor') {
        return res.status(403).json({ success: false, message: 'Accès réservé aux médecins.' });
    }
    next();
};

// Soumettre un compte rendu de consultation (réservé aux médecins)
router.post('/submit', authMiddleware, doctorOnly, submitReport);

// Récupérer le compte rendu d'un RDV (médecin du RDV ou patient concerné)
router.get('/appointment/:id', authMiddleware, getReportByAppointment);

// Récupérer la timeline d'un patient (médecin traitant ou patient lui-même)
router.get('/patient/:phone/timeline', authMiddleware, getPatientTimeline);

// Récupérer l'historique des accès au dossier (patient concerné uniquement)
router.get('/access-log/:phone', authMiddleware, getDossierAccessLog);

module.exports = router;
