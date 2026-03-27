const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Route pour demander un code
router.post('/request-otp', authController.requestOtp);

// Route pour vérifier le code
router.post('/verify-otp', authController.verifyOtp);

module.exports = router;
