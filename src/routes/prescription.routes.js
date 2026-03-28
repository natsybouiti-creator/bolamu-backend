const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth.middleware');

const {
    createPrescription,
    getPrescriptionBySession,
    deliverPrescription,
    getPrescriptionsByPharmacie,
    getPrescriptionsByPatient
} = require('../controllers/prescription.controller');

// Médecin crée une ordonnance après consultation validée
router.post('/create', authMiddleware, createPrescription);

// Pharmacie scanne le code session patient → récupère l'ordonnance
router.get('/by-session/:code', authMiddleware, getPrescriptionBySession);

// Pharmacie confirme la délivrance
router.post('/deliver', authMiddleware, deliverPrescription);

// Historique des délivrances d'une pharmacie
router.get('/pharmacie/:phone', authMiddleware, getPrescriptionsByPharmacie);

// Ordonnances d'un patient (pour son dashboard)
router.get('/patient/:phone', authMiddleware, getPrescriptionsByPatient);

module.exports = router;