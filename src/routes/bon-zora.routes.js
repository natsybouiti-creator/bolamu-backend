// ============================================================
// BOLAMU — Routes Bons Zora Partenaires (code BOL-XXXX-XXXX)
// Terminologie : 'voucher' remplacé par 'bon Zora' (décision produit, sprint dette technique)
// ============================================================
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth.middleware');
const {
  generateBonZora,
  validateBonZora,
  getPatientBonsZora,
  getProgramsByCategory,
  getProgramById
} = require('../services/bon-zora.service');

// Middleware inline pour rôle partenaire (fabrique globale inexistante)
// Rôles réels des comptes partenaires du système (aucun compte n'a jamais role='partenaire')
const PARTENAIRE_ROLES = ['pharmacie', 'doctor', 'laboratoire'];
const requirePartenaire = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, error: 'non_authentifie' });
  if (!PARTENAIRE_ROLES.includes(req.user.role)) {
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

// GET /api/v1/bons-zora/programs — Liste programmes actifs (public)
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
    console.error('[BON ZORA ROUTES] Erreur GET /programs:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// GET /api/v1/bons-zora/programs/:id — Détail d'un programme partenaire (authentifié)
router.get('/programs/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getProgramById(id);
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      const statusCode = result.error === 'program_not_found' ? 404 : 500;
      res.status(statusCode).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[BON ZORA ROUTES] Erreur GET /programs/:id:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// POST /api/v1/bons-zora/generate — Patient génère un bon Zora
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const { program_id } = req.body;
    const phone = req.user.phone;
    if (!program_id) {
      return res.status(400).json({ success: false, error: 'missing_program_id' });
    }
    const result = await generateBonZora(phone, program_id);
    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      const statusMap = {
        'program_not_found': 404,
        'program_out_of_stock': 400,
        'no_zora_account': 404,
        'insufficient_balance': 400,
        'bon_zora_code_collision': 500
      };
      const statusCode = statusMap[result.error] || 500;
      res.status(statusCode).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[BON ZORA ROUTES] Erreur POST /generate:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// GET /api/v1/bons-zora/my — Liste bons Zora du patient connecté
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const phone = req.user.phone;
    const result = await getPatientBonsZora(phone);
    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[BON ZORA ROUTES] Erreur GET /my:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// POST /api/v1/bons-zora/validate — Partenaire valide un bon Zora
router.post('/validate', authMiddleware, requirePartenaire, async (req, res) => {
  try {
    const { code } = req.body;
    const partner_phone = req.user.phone;
    if (!code) {
      return res.status(400).json({ success: false, error: 'missing_code' });
    }
    const result = await validateBonZora(code, partner_phone, 'code_manual');
    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      const statusMap = {
        'bon_zora_not_found': 404,
        'bon_zora_already_used': 400,
        'bon_zora_cancelled': 400,
        'bon_zora_expired': 400,
        'bon_zora_not_active': 400
      };
      const statusCode = statusMap[result.error] || 500;
      res.status(statusCode).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[BON ZORA ROUTES] Erreur POST /validate:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// POST /api/v1/bons-zora/validate/qr — Partenaire valide via QR scan (méthode distincte)
router.post('/validate/qr', authMiddleware, requirePartenaire, async (req, res) => {
  try {
    const { code } = req.body;
    const partner_phone = req.user.phone;
    if (!code) {
      return res.status(400).json({ success: false, error: 'missing_code' });
    }
    const result = await validateBonZora(code, partner_phone, 'qr_scan');
    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      const statusMap = {
        'bon_zora_not_found': 404,
        'bon_zora_already_used': 400,
        'bon_zora_cancelled': 400,
        'bon_zora_expired': 400,
        'bon_zora_not_active': 400
      };
      const statusCode = statusMap[result.error] || 500;
      res.status(statusCode).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[BON ZORA ROUTES] Erreur POST /validate/qr:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// GET /api/v1/bons-zora/:code/qr — QR payload pour affichage (patient uniquement)
router.get('/:code/qr', authMiddleware, async (req, res) => {
  try {
    const { code } = req.params;
    const phone = req.user.phone;
    if (!code) {
      return res.status(400).json({ success: false, error: 'missing_code' });
    }
    // Vérifier que le patient est bien le propriétaire du bon Zora
    const result = await pool.query(
      `SELECT qr_payload, patient_phone FROM partner_bons_zora WHERE code = $1`,
      [String(code).trim().toUpperCase()]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'bon_zora_not_found' });
    }
    const bon = result.rows[0];
    if (bon.patient_phone !== phone) {
      return res.status(403).json({ success: false, error: 'not_owner' });
    }
    let qrPayload = null;
    try {
      qrPayload = typeof bon.qr_payload === 'string'
        ? JSON.parse(bon.qr_payload)
        : bon.qr_payload;
    } catch (_) {
      return res.status(500).json({ success: false, error: 'invalid_qr_payload' });
    }
    res.json({ success: true, data: qrPayload });
  } catch (error) {
    console.error('[BON ZORA ROUTES] Erreur GET /:code/qr:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

module.exports = router;
