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
const { validateVoucherHandler, getValidationsHandler } = require('../controllers/partenaire.controller');

if (!process.env.JWT_SECRET) throw new Error('[FATAL] JWT_SECRET non défini');
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware inline pour rôle partenaire
const requirePartenaire = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, error: 'non_authentifie' });
  if (req.user.role !== 'partenaire') {
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

    // Vérifier utilisateur avec role='partenaire'
    const userResult = await pool.query(
      'SELECT * FROM users WHERE phone = $1 AND role = $2',
      [phoneNormalized, 'partenaire']
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

// GET /api/v1/partenaire/stats — Stats du partenaire connecté
router.get('/stats', authMiddleware, requirePartenaire, async (req, res) => {
  try {
    const phone = req.user.phone;

    // Vouchers validés ce mois (COUNT + SUM fcfa_value)
    const monthResult = await pool.query(
      `SELECT COUNT(*) as count, SUM(fcfa_value) as total_fcfa
       FROM partner_vouchers
       WHERE used_by = $1
         AND status = 'used'
         AND used_at >= DATE_TRUNC('month', CURRENT_DATE)`,
      [phone]
    );

    const monthlyCount = parseInt(monthResult.rows[0].count) || 0;
    const monthlyFcfa = parseInt(monthResult.rows[0].total_fcfa) || 0;

    // Vouchers en attente de validation (statut='active' et non expiré)
    const pendingResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM partner_vouchers
       WHERE status = 'active'
         AND expires_at > NOW()`,
      []
    );

    const pendingCount = parseInt(pendingResult.rows[0].count) || 0;

    // Programme de fidélité actif (premier programme actif avec stock > 0)
    const programResult = await pool.query(
      `SELECT id, name, stock
       FROM partner_programs
       WHERE is_active = TRUE
         AND (stock IS NULL OR stock > 0)
       ORDER BY created_at DESC
       LIMIT 1`,
      []
    );

    const activeProgram = programResult.rows.length > 0 ? programResult.rows[0] : null;

    res.json({
      success: true,
      data: {
        monthly_count: monthlyCount,
        monthly_fcfa: monthlyFcfa,
        pending_count: pendingCount,
        active_program: activeProgram ? { name: activeProgram.name } : null,
        active_program_stock: activeProgram ? (activeProgram.stock === null ? 'Illimité' : activeProgram.stock) : null
      }
    });
  } catch (error) {
    console.error('[PARTENAIRE ROUTES] Erreur GET /stats:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// POST /api/v1/partenaire/voucher/validate — Valider un voucher Zora
router.post('/voucher/validate', authMiddleware, requirePartenaire, validateVoucherHandler);

// GET /api/v1/partenaire/validations — Liste des validations du jour
router.get('/validations', authMiddleware, requirePartenaire, getValidationsHandler);

module.exports = router;
