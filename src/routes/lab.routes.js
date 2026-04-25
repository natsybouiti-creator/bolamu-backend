const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const bcrypt = require('bcrypt');
const pool = require('../config/db');

const {
    createLabPrescription,
    submitLabResults,
    getLabResultsByPatient,
    getLabResultsForLab,
    getLabPrescriptionByCode,
    upload
} = require('../controllers/lab.controller');

// Middleware pour restreindre aux médecins
const doctorOnly = (req, res, next) => {
    if (req.user?.role !== 'doctor') {
        return res.status(403).json({ success: false, message: 'Accès réservé aux médecins.' });
    }
    next();
};

// Middleware pour restreindre aux laborantins
const labOnly = (req, res, next) => {
    if (req.user?.role !== 'laboratoire') {
        return res.status(403).json({ success: false, message: 'Accès réservé aux laboratoires.' });
    }
    next();
};

// Créer une prescription labo (réservé aux médecins)
router.post('/prescribe', authMiddleware, doctorOnly, createLabPrescription);

// Déposer les résultats labo (réservé aux laborantins)
router.post('/results/submit', authMiddleware, labOnly, upload.single('fichier'), submitLabResults);

// Récupérer les résultats labo d'un patient (patient, médecin traitant, laborantin concerné)
router.get('/results/patient/:phone', authMiddleware, getLabResultsByPatient);

// Récupérer les prescriptions en attente pour ce laboratoire (réservé aux laborantins)
router.get('/pending', authMiddleware, labOnly, getLabResultsForLab);

// Récupérer une prescription par code (réservé aux laborantins)
router.get('/prescription/:code', authMiddleware, labOnly, getLabPrescriptionByCode);

router.post('/change-password', authMiddleware, async (req, res) => {
  const { phone, old_password, new_password } = req.body;
  if (!phone || !old_password || !new_password) return res.status(400).json({ success: false, message: 'Champs manquants' });
  if (new_password.length < 6) return res.status(400).json({ success: false, message: 'Le nouveau mot de passe doit faire au moins 6 caractères' });
  try {
    const result = await pool.query(`SELECT password_hash FROM users WHERE phone = $1`, [phone]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Compte introuvable' });
    const valid = await bcrypt.compare(old_password, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ success: false, message: 'Ancien mot de passe incorrect' });
    const newHash = await bcrypt.hash(new_password, 10);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE phone = $2`, [newHash, phone]);
    res.json({ success: true, message: 'Mot de passe modifié avec succès' });
  } catch(e) {
    console.error('[change-password]', e.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
