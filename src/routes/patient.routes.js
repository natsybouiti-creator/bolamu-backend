const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth.middleware');
const { normalizePhone } = require('../utils/phone');
const patientController = require('../controllers/patient.controller');
const bcrypt = require('bcrypt');
const idempotencyMiddleware = require('../middleware/idempotency');
const { upgradeAbonnement } = require('../services/prorata.service');
const { calculerScoreBolamu } = require('../services/scoreBolamu.service');

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

// Créer un abonnement (POST /api/v1/patients/subscription)
router.post('/subscription', authMiddleware, patientController.createSubscription);

// Modifier mot de passe (PATCH /api/v1/patients/password)
router.patch('/password', authMiddleware, patientController.changePassword);

// Upgrade abonnement (PATCH /api/v1/patients/subscription/upgrade)
router.patch('/subscription/upgrade', authMiddleware, idempotencyMiddleware('/subscription/upgrade'), async (req, res) => {
    const { nouveau_plan, coupon_code } = req.body;
    const patientPhone = req.user.phone;

    // Validation montant côté serveur uniquement (TC-113) - ignorer montant envoyé par le client
    // Le montant sera calculé par calculProrata dans upgradeAbonnement

    if (!nouveau_plan) {
        return res.status(400).json({ success: false, message: 'Nouveau plan requis.' });
    }

    try {
        const result = await upgradeAbonnement(patientPhone, nouveau_plan, coupon_code);
        return res.json(result);
    } catch (error) {
        console.error('[upgradeSubscription]', error.message);
        return res.status(400).json({ success: false, message: error.message });
    }
});

router.get('/profil', authMiddleware, async (req, res) => {
    try {
        const phone = normalizePhone(req.user.phone);

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
        const phone = normalizePhone(req.user.phone);

        const result = await pool.query(
            `SELECT status, plan, expires_at 
             FROM subscriptions 
             WHERE patient_phone = $1 AND status = 'active' AND expires_at > NOW() 
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
  const phone = req.user.phone;
  const { old_password, new_password } = req.body;
  if (!old_password || !new_password) return res.status(400).json({ success: false, message: 'Champs manquants' });
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

router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Requête trop courte (min 2 caractères)' });
    }

    const query = q.trim();
    const normalizedQuery = query.replace(/\+/g, '');
    const result = await pool.query(
      `SELECT u.phone, u.full_name, u.bolamu_id as account_number, 
              u.member_code, s.plan as plan_nom, s.status as subscription_status, u.is_active
       FROM users u
       LEFT JOIN subscriptions s ON u.phone = s.patient_phone AND s.status = 'active' AND s.expires_at > NOW()
       WHERE u.role = 'patient' 
         AND (REPLACE(u.phone, '+', '') ILIKE $1 
              OR u.full_name ILIKE $1 
              OR u.bolamu_id ILIKE $1
              OR u.member_code ILIKE $1)
       ORDER BY u.full_name
       LIMIT 10`,
      [`%${normalizedQuery}%`]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[patients-search]', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/patient/score-bienetre - Score Bolamu du patient connecté
router.get('/score-bienetre', authMiddleware, async (req, res) => {
  try {
    const patientPhone = req.user.phone;
    const scoreData = await calculerScoreBolamu(patientPhone);
    res.json({ success: true, data: scoreData });
  } catch (error) {
    console.error('[score-bienetre]', error.message);
    res.status(500).json({ success: false, message: 'Erreur lors du calcul du score' });
  }
});

module.exports = router;