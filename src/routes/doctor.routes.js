// ============================================================
// BOLAMU — Routes médecins
// ============================================================

const express = require('express');
const router = express.Router();
const { registerDoctor, getDoctors } = require('../controllers/doctor.controller');

// POST /api/v1/doctors/register
router.post('/register', registerDoctor);

// GET /api/v1/doctors
router.get('/', getDoctors);

module.exports = router;