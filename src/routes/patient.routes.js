const express = require('express');
const router = express.Router();
const path = require('path');

const cheminCerveau = path.join(__dirname, '..', 'controllers', 'patient.controller.js');
console.log('🔎 Bolamu cherche le fichier ici :', cheminCerveau);

const { registerPatient, getSubscription } = require(cheminCerveau);

router.post('/register', registerPatient);
router.get('/subscription', getSubscription);

module.exports = router;