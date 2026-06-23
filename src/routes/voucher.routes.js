// ============================================================
// BOLAMU — Routes Vouchers Partenaires (code BOL-XXXX-XXXX)
// ============================================================
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth.middleware');
const {
  generateVoucher,
  validateVoucher,
  getPatientVouchers,
  getProgramsByCategory
} = require('../services/voucher.service');

// Middleware inline pour rôle partenaire (fabrique globale inexistante)
const requirePartenaire = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, error: 'non_authentifie' });
  if (req.user.role !== 'partenaire') {
    return res.status(403).json({ success: false, error: 'acces_reserve_partenaire' });
  }
  next();
};

// Middleware inline pour rôle animateur (même pattern)
const requireAnimateur = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, error: 'non_authentifie' });
  if (req.user.role !== 'animateur') {
    return res.status(403).json({ success: false, error: 'acces_reserve_animateur' });
  }
  next();
};

// GET /api/v1/vouchers/programs — Liste programmes actifs (public)
router.get('/programs', async (req, res) => {
  try {
    const { category } = req.query;
    const result = await getProgramsByCategory(category);
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[VOUCHER ROUTES] Erreur GET /programs:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// POST /api/v1/vouchers/generate — Patient génère un voucher
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const { program_id } = req.body;
    const phone = req.user.phone;
    if (!program_id) {
      return res.status(400).json({ success: false, error: 'missing_program_id' });
    }
    const result = await generateVoucher(phone, program_id);
    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      const statusMap = {
        'program_not_found': 404,
        'program_out_of_stock': 400,
        'no_zora_account': 404,
        'insufficient_balance': 400,
        'voucher_code_collision': 500
      };
      const statusCode = statusMap[result.error] || 500;
      res.status(statusCode).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[VOUCHER ROUTES] Erreur POST /generate:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// GET /api/v1/vouchers/my — Liste vouchers du patient connecté
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const phone = req.user.phone;
    const result = await getPatientVouchers(phone);
    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[VOUCHER ROUTES] Erreur GET /my:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// POST /api/v1/vouchers/validate — Partenaire valide un voucher
router.post('/validate', authMiddleware, requirePartenaire, async (req, res) => {
  try {
    const { code } = req.body;
    const partner_phone = req.user.phone;
    if (!code) {
      return res.status(400).json({ success: false, error: 'missing_code' });
    }
    const result = await validateVoucher(code, partner_phone, 'code_manual');
    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      const statusMap = {
        'voucher_not_found': 404,
        'voucher_already_used': 400,
        'voucher_cancelled': 400,
        'voucher_expired': 400,
        'voucher_not_active': 400
      };
      const statusCode = statusMap[result.error] || 500;
      res.status(statusCode).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[VOUCHER ROUTES] Erreur POST /validate:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// POST /api/v1/vouchers/validate/qr — Partenaire valide via QR scan (méthode distincte)
router.post('/validate/qr', authMiddleware, requirePartenaire, async (req, res) => {
  try {
    const { code } = req.body;
    const partner_phone = req.user.phone;
    if (!code) {
      return res.status(400).json({ success: false, error: 'missing_code' });
    }
    const result = await validateVoucher(code, partner_phone, 'qr_scan');
    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      const statusMap = {
        'voucher_not_found': 404,
        'voucher_already_used': 400,
        'voucher_cancelled': 400,
        'voucher_expired': 400,
        'voucher_not_active': 400
      };
      const statusCode = statusMap[result.error] || 500;
      res.status(statusCode).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[VOUCHER ROUTES] Erreur POST /validate/qr:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// GET /api/v1/vouchers/:code/qr — QR payload pour affichage (patient uniquement)
router.get('/:code/qr', authMiddleware, async (req, res) => {
  try {
    const { code } = req.params;
    const phone = req.user.phone;
    if (!code) {
      return res.status(400).json({ success: false, error: 'missing_code' });
    }
    // Vérifier que le patient est bien le propriétaire du voucher
    const result = await pool.query(
      `SELECT qr_payload, patient_phone FROM partner_vouchers WHERE code = $1`,
      [String(code).trim().toUpperCase()]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'voucher_not_found' });
    }
    const voucher = result.rows[0];
    if (voucher.patient_phone !== phone) {
      return res.status(403).json({ success: false, error: 'not_owner' });
    }
    let qrPayload = null;
    try {
      qrPayload = typeof voucher.qr_payload === 'string'
        ? JSON.parse(voucher.qr_payload)
        : voucher.qr_payload;
    } catch (_) {
      return res.status(500).json({ success: false, error: 'invalid_qr_payload' });
    }
    res.json({ success: true, data: qrPayload });
  } catch (error) {
    console.error('[VOUCHER ROUTES] Erreur GET /:code/qr:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

module.exports = router;
