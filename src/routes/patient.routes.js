const express = require('express');
const router = express.Router();
const path = require('path');

// On demande à Node de nous dire exactement où il cherche
const cheminCerveau = path.join(__dirname, '..', 'controllers', 'patient.controller.js');
console.log('🔎 Bolamu cherche le fichier ici :', cheminCerveau);

// On essaie de charger le contrôleur avec le chemin complet
const { registerPatient } = require(cheminCerveau);

router.post('/register', registerPatient);

module.exports = router;
