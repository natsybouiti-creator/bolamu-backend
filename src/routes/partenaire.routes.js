// ============================================================
// BOLAMU — Routes Partenaire (login + stats + vouchers)
// ============================================================
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { normalizePhone } = require('../utils/phone');
const authMiddleware = require('../middleware/auth.middleware');

if (!process.env.JWT_SECRET) throw new Error('[FATAL] JWT_SECRET non défini');
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware inline pour rôle partenaire
// Rôles réels des comptes partenaires du système (aucun compte n'a jamais role='partenaire')
const PARTENAIRE_ROLES = ['pharmacie', 'doctor', 'laboratoire'];
const requirePartenaire = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, error: 'non_authentifie' });
  if (!PARTENAIRE_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'acces_reserve_partenaire' });
  }
  next();
};

// POST /api/v1/partenaire/login — Connexion partenaire
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ success: false, error: 'missing_credentials' });
    }

    const phoneNormalized = normalizePhone(phone);
    if (!phoneNormalized) {
      return res.status(400).json({ success: false, error: 'invalid_phone' });
    }

    // Vérifier utilisateur avec role='partenaire_commercial' (ou 'partenaire' legacy, jamais réellement utilisé)
    const userResult = await pool.query(
      'SELECT * FROM users WHERE phone = $1 AND role = ANY($2::text[])',
      [phoneNormalized, ['partenaire', 'partenaire_commercial']]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'invalid_credentials' });
    }

    const user = userResult.rows[0];

    // Vérifier mot de passe (bcrypt sur password_hash ou password pour compatibilité)
    const passwordMatch = await bcrypt.compare(password, user.password_hash || user.password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'invalid_credentials' });
    }

    // Vérifier is_active
    if (user.is_active === false) {
      return res.status(403).json({ success: false, error: 'account_inactive' });
    }

    // Générer JWT token (15 min)
    const token = jwt.sign(
      {
        phone: user.phone,
        role: user.role,
        is_active: user.is_active,
        banned: user.banned || false
      },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({
      success: true,
      token,
      partenaire: {
        phone: user.phone,
        full_name: user.full_name,
        is_active: user.is_active
      }
    });
  } catch (error) {
    console.error('[PARTENAIRE ROUTES] Erreur POST /login:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// GET /api/v1/partenaire/stats — DÉPRÉCIÉE
// Interrogeait partner_vouchers, table jamais créée en prod (le système
// zora_vouchers/partner_vouchers a été remplacé par partner_bons_zora,
// cf. bon-zora.service.js). Seul consommateur : public/partenaire/dashboard.html,
// lui-même inatteignable car POST /partenaire/login exige role='partenaire',
// valeur qu'aucun compte réel ne porte. Neutralisée plutôt que réécrite :
// pas de front vivant à servir tant que le concept de compte partenaire
// générique n'est pas retranché (décision produit séparée).
router.get('/stats', authMiddleware, requirePartenaire, (req, res) => {
  res.status(410).json({
    success: false,
    message: 'Route dépréciée — système partner_vouchers jamais mis en production'
  });
});

// POST /api/v1/partenaire/voucher/validate — Valider un voucher Zora
// DÉPRÉCIÉ — utiliser /vouchers/* à la place
// (zora-voucher.service.js consolidé vers partner_vouchers/voucher.service.js)
router.post('/voucher/validate', authMiddleware, requirePartenaire, (req, res) => {
  res.status(410).json({
    success: false,
    message: 'Route dépréciée — utiliser /vouchers/*'
  });
});

// GET /api/v1/partenaire/validations — DÉPRÉCIÉE
// getValidationsHandler (partenaire.controller.js) fait JOIN zv.voucher_code = v.uuid
// (varchar = uuid, erreur SQL au runtime — colonne jamais compatible). Même
// système zora_vouchers déprécié que /stats ci-dessus, même dashboard
// inatteignable comme seul consommateur. Neutralisée pour la même raison.
router.get('/validations', authMiddleware, requirePartenaire, (req, res) => {
  res.status(410).json({
    success: false,
    message: 'Route dépréciée — système zora_vouchers jamais mis en production'
  });
});

module.exports = router;
