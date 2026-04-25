const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth.middleware');
const patientController = require('../controllers/patient.controller');
const bcrypt = require('bcrypt');

const register = patientController.registerPatient || ((req, res) => {
    res.status(501).json({ success: false, message: "Fonction d'inscription non configurée" });
});

const subscription = patientController.getSubscription || ((req, res) => {
    res.status(501).json({ success: false, message: "Fonction d'abonnement non configurée" });
});

// --- ROUTES PUBLIQUES ---
router.post('/register', register);

// --- ROUTES PROTÉGÉES ---
router.get('/subscription', authMiddleware, subscription);

router.get('/profil', authMiddleware, async (req, res) => {
    try {
        const { phone } = req.query;
        if (!phone) return res.status(400).json({ success: false, message: 'Numéro de téléphone requis' });

        const result = await pool.query(
            `SELECT phone, full_name, gender, birth_date, city, neighborhood, bolamu_id, is_active, created_at 
             FROM users 
             WHERE phone = $1 AND role = 'patient'`,
            [phone]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Patient introuvable' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('[patient-profil]', err.message);
        res.status(500).json({ success: false, message: 'Erreur lors de la récupération du profil' });
    }
});

router.get('/check-subscription', authMiddleware, async (req, res) => {
    try {
        const { phone } = req.query;
        if (!phone) return res.status(400).json({ success: false, message: 'Numéro de téléphone requis' });

        const result = await pool.query(
            `SELECT status, plan, expires_at 
             FROM subscriptions 
             WHERE phone = $1 AND status = 'active' AND expires_at > NOW() 
             ORDER BY expires_at DESC LIMIT 1`,
            [phone]
        );

        res.json({
            success: true,
            has_active_subscription: result.rows.length > 0,
            subscription: result.rows[0] || null
        });
    } catch (err) {
        console.error('[check-subscription]', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

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