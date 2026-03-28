const express = require('express');
const router = express.Router();
const { createPrescription } = require('../controllers/prescription.controller');

router.post('/create', createPrescription);

module.exports = router;