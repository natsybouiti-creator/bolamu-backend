const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth.middleware');
const { generateQRToken, verifyQRToken } = require('../controllers/qr.controller');

// Patient : génère son QR Code (authentifié)
router.get('/generate', authMiddleware, generateQRToken);

// Partenaire : scanne et vérifie un QR Code (authentifié)
router.post('/verify', authMiddleware, verifyQRToken);

module.exports = router;