const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');

const {
    createLabPrescription,
    submitLabResults,
    getLabResultsByPatient,
    getLabResultsForLab,
    getLabPrescriptionByCode,
    upload
} = require('../controllers/lab.controller');

// Middleware pour restreindre aux médecins
const doctorOnly = (req, res, next) => {
    if (req.user?.role !== 'doctor') {
        return res.status(403).json({ success: false, message: 'Accès réservé aux médecins.' });
    }
    next();
};

// Middleware pour restreindre aux laborantins
const labOnly = (req, res, next) => {
    if (req.user?.role !== 'laboratoire') {
        return res.status(403).json({ success: false, message: 'Accès réservé aux laboratoires.' });
    }
    next();
};

// Créer une prescription labo (réservé aux médecins)
router.post('/prescribe', authMiddleware, doctorOnly, createLabPrescription);

// Déposer les résultats labo (réservé aux laborantins)
router.post('/results/submit', authMiddleware, labOnly, upload.single('fichier'), submitLabResults);

// Récupérer les résultats labo d'un patient (patient, médecin traitant, laborantin concerné)
router.get('/results/patient/:phone', authMiddleware, getLabResultsByPatient);

// Récupérer les prescriptions en attente pour ce laboratoire (réservé aux laborantins)
router.get('/pending', authMiddleware, labOnly, getLabResultsForLab);

// Récupérer une prescription par code (réservé aux laborantins)
router.get('/prescription/:code', authMiddleware, labOnly, getLabPrescriptionByCode);

module.exports = router;
