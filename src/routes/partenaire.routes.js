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
const PARTENAIRE_ROLES = ['pharmacie', 'doctor', 'laboratoire', 'partenaire_commercial'];
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

// GET /api/v1/partenaire/stats — Statistiques du partenaire connecté
// Réécrite (Phase 3C) pour interroger partner_bons_zora / partner_programs,
// le système réellement actif (partner_vouchers n'a jamais existé en prod).
router.get('/stats', authMiddleware, requirePartenaire, async (req, res) => {
  try {
    const phone = req.user.phone;

    // Bons que CE partenaire a personnellement validés ce mois-ci
    const monthResult = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(fcfa_value), 0) as total_fcfa
       FROM partner_bons_zora
       WHERE used_by = $1
         AND status = 'used'
         AND used_at >= DATE_TRUNC('month', CURRENT_DATE)`,
      [phone]
    );

    const monthlyCount = parseInt(monthResult.rows[0].count) || 0;
    const monthlyFcfa = parseInt(monthResult.rows[0].total_fcfa) || 0;

    // Bons actifs (non encore validés) émis sur les programmes de CE partenaire.
    // NOTE : partner_bons_zora.partner_id référence en réalité partner_programs.id
    // (nom de colonne trompeur, cf. commentaire bon-zora.service.js ligne 161).
    const pendingResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM partner_bons_zora pbz
       JOIN partner_programs pp ON pp.id = pbz.partner_id
       WHERE pp.partner_phone = $1
         AND pbz.status = 'active'`,
      [phone]
    );

    const pendingCount = parseInt(pendingResult.rows[0].count) || 0;

    // Programme de fidélité actif le plus récent de ce partenaire
    const programResult = await pool.query(
      `SELECT id, name, stock
       FROM partner_programs
       WHERE partner_phone = $1
         AND is_active = TRUE
         AND (stock IS NULL OR stock > 0)
       ORDER BY created_at DESC
       LIMIT 1`,
      [phone]
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
// DÉPRÉCIÉ — utiliser /bons-zora/validate ou /bons-zora/validate/qr à la place
// (remplacé par bon-zora.service.js / bon-zora.routes.js)
router.post('/voucher/validate', authMiddleware, requirePartenaire, (req, res) => {
  res.status(410).json({
    success: false,
    message: 'Route dépréciée — utiliser /bons-zora/validate ou /bons-zora/validate/qr'
  });
});

// GET /api/v1/partenaire/validations — Historique des validations de CE partenaire
// Réécrite (Phase 3C) sur partner_validations/partner_bons_zora (système actif).
// BHP : jamais le nom complet du patient — patient_initiales déjà embarqué dans
// qr_payload à la génération du bon (cf. bon-zora.service.js buildInitials()).
router.get('/validations', authMiddleware, requirePartenaire, async (req, res) => {
  try {
    const phone = req.user.phone;

    const result = await pool.query(
      `SELECT pv.method, pv.validated_at, pbz.code, pbz.fcfa_value, pbz.qr_payload
       FROM partner_validations pv
       JOIN partner_bons_zora pbz ON pbz.id = pv.voucher_id
       WHERE pv.partner_phone = $1
       ORDER BY pv.validated_at DESC
       LIMIT 20`,
      [phone]
    );

    const validations = result.rows.map(row => {
      let patientInitiales = '—';
      let partnerName = null;
      try {
        const payload = typeof row.qr_payload === 'string' ? JSON.parse(row.qr_payload) : row.qr_payload;
        if (payload && payload.patient_initiales) patientInitiales = payload.patient_initiales;
        if (payload && payload.partner_name) partnerName = payload.partner_name;
      } catch (_) {
        // payload illisible — garder les placeholders
      }
      return {
        code: row.code,
        patient_name: patientInitiales,
        reward_name: partnerName,
        fcfa_value: row.fcfa_value,
        validated_at: row.validated_at,
        method: row.method
      };
    });

    res.json({ success: true, data: validations });
  } catch (error) {
    console.error('[PARTENAIRE ROUTES] Erreur GET /validations:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

module.exports = router;
