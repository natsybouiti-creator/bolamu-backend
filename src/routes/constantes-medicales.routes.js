const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const {
    getConstantes,
    updateConstantesPatient,
    updateConstantesMedecin
} = require('../controllers/constantes-medicales.controller');

// Patient — voir ses propres constantes
router.get('/constantes/:phone', authMiddleware, getConstantes);

// Patient — modifier ses constantes (POST pour compatibilité frontend)
router.post('/constantes', authMiddleware, updateConstantesPatient);

// Patient — modifier ses constantes (PATCH RESTful)
router.patch('/constantes', authMiddleware, updateConstantesPatient);

// Médecin — modifier les constantes d'un patient
router.patch('/constantes-patient', authMiddleware, updateConstantesMedecin);

module.exports = router;
