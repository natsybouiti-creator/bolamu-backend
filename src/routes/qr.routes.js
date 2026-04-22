const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { generateQRToken, verifyQRToken, generatePatientQR, accessEmergencyDossier } = require('../controllers/qr.controller');

// Patient : génère son QR Code (authentifié)
router.get('/generate', authMiddleware, generateQRToken);

// Partenaire : scanne et vérifie un QR Code (authentifié)
router.post('/verify', authMiddleware, verifyQRToken);

// Patient : génère QR Code urgence (authentifié)
router.get('/emergency/generate', authMiddleware, generatePatientQR);

// Public : accède au dossier urgence via QR (pas d'auth)
router.get('/urgence', accessEmergencyDossier);

module.exports = router;