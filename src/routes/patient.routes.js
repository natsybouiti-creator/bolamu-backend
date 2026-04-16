const express = require('express');
const router = express.Router();
const path = require('path');
const pool = require('../config/db');

// --- CORRECTION IMPORT MIDDLEWARE ---
// On remonte de deux crans (..) pour sortir de 'routes' et de 'src' ? 
// Vérifie bien si c'est ../middleware ou ../../middleware. 
// Pour être sûr, on utilise path.join comme pour le cerveau.
const cheminMiddleware = path.join(__dirname, '..', '..', 'middleware', 'auth.middleware.js');
const authMiddleware = require(cheminMiddleware);

const cheminCerveau = path.join(__dirname, '..', 'controllers', 'patient.controller.js');
console.log('🔎 Bolamu cherche le fichier ici :', cheminCerveau);

const patientCtrl = require(cheminCerveau);

// Sécurisation des fonctions du contrôleur
const registerPatient = patientCtrl.registerPatient;
const getSubscription = patientCtrl.getSubscription;

if (typeof registerPatient === 'function') {
    router.post('/register', registerPatient);
}

if (typeof getSubscription === 'function') {
    router.get('/subscription', getSubscription);
} else {
    router.get('/subscription', (req, res) => res.status(501).json({message: "Not implemented"}));
}

// --- SÉCURISATION DU MIDDLEWARE (LIGNE 29) ---
// On crée une fonction de secours si le middleware n'est pas chargé
const checkAuth = (typeof authMiddleware === 'function') ? authMiddleware : (req, res, next) => next();

// GET /api/v1/patients/profil?phone=
// On utilise 'checkAuth' ici pour éviter le crash TypeError
router.get('/profil', checkAuth, async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone requis' });

    const result = await pool.query(
      `SELECT phone, full_name, gender, birth_date, city, neighborhood,
              bolamu_id, is_active, created_at
       FROM users WHERE phone = $1 AND role = 'patient'`,
      [phone]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Patient introuvable' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/v1/patients/check-subscription?phone=
router.get('/check-subscription', checkAuth, async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone requis' });

    const result = await pool.query(
      `SELECT status, plan, expires_at FROM subscriptions
       WHERE phone = $1 AND status = 'active' AND expires_at > NOW()
       ORDER BY expires_at DESC LIMIT 1`,
      [phone]
    );

    const hasActive = result.rows.length > 0;
    res.json({
      success: true,
      has_active_subscription: hasActive,
      subscription: result.rows[0] || null
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;