// ============================================================
// BOLAMU — Routes Bons Zora Partenaires (code BOL-XXXX-XXXX)
// Terminologie : 'voucher' remplacé par 'bon Zora' (décision produit, sprint dette technique)
// ============================================================
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth.middleware');
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});
const handleMulterError = (err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'Fichier trop volumineux (max 5MB)' });
  }
  next(err);
};
const { uploadToCloudinary } = require('../utils/cloudinary');
const {
  generateBonZora,
  validateBonZora,
  getPatientBonsZora,
  getProgramsByCategory,
  getProgramById,
  createProgram,
  updateProgram,
  deactivateProgram
} = require('../services/bon-zora.service');

// Middleware inline pour rôle partenaire (fabrique globale inexistante)
// Rôles réels des comptes partenaires du système (aucun compte n'a jamais role='partenaire')
const PARTENAIRE_ROLES = ['pharmacie', 'doctor', 'laboratoire', 'partenaire_commercial'];
const requirePartenaire = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, error: 'non_authentifie' });
  if (!PARTENAIRE_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'acces_reserve_partenaire' });
  }
  next();
};

// Rôles autorisés à gérer des offres (partenaires santé + partenaire commercial + admin)
const PROGRAM_MANAGER_ROLES = [...PARTENAIRE_ROLES, 'admin'];
const requireProgramManager = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, error: 'non_authentifie' });
  if (!PROGRAM_MANAGER_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'acces_reserve_gestionnaire_offres' });
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

// POST /api/v1/bons-zora/programs — Créer une offre (partenaire authentifié ou admin)
router.post('/programs', authMiddleware, requireProgramManager, upload.single('image'), handleMulterError, async (req, res) => {
  try {
    const { name, description, zora_cost, fcfa_value, category, stock } = req.body;

    if (!name || !zora_cost) {
      return res.status(400).json({ success: false, error: 'missing_required_fields' });
    }

    // partner_phone = le partenaire authentifié, sauf si l'admin crée pour un partenaire précis
    let partnerPhone = req.user.phone;
    if (req.user.role === 'admin' && req.body.partner_phone) {
      partnerPhone = req.body.partner_phone;
    }

    let imageUrl = null;
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer, 'bolamu/partner_programs', {
        public_id: `program_${Date.now()}`,
        transformation: { width: 600, height: 300, crop: 'fill' }
      });
      imageUrl = uploadResult.secure_url;
    }

    const result = await createProgram({
      partner_phone: partnerPhone,
      name,
      description,
      zora_cost: parseInt(zora_cost, 10),
      fcfa_value: fcfa_value !== undefined && fcfa_value !== '' ? parseInt(fcfa_value, 10) : null,
      category,
      stock: stock !== undefined && stock !== '' ? parseInt(stock, 10) : null,
      image_url: imageUrl
    });

    if (result.success) {
      res.status(201).json({ success: true, data: result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[BON ZORA ROUTES] Erreur POST /programs:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// PUT /api/v1/bons-zora/programs/:id — Modifier une offre (propriétaire ou admin)
router.put('/programs/:id', authMiddleware, requireProgramManager, upload.single('image'), handleMulterError, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, zora_cost, fcfa_value, category, stock, is_active } = req.body;

    let imageUrl;
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer, 'bolamu/partner_programs', {
        public_id: `program_${id}_${Date.now()}`,
        transformation: { width: 600, height: 300, crop: 'fill' }
      });
      imageUrl = uploadResult.secure_url;
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (zora_cost !== undefined) updates.zora_cost = parseInt(zora_cost, 10);
    if (fcfa_value !== undefined) updates.fcfa_value = parseInt(fcfa_value, 10);
    if (category !== undefined) updates.category = category;
    if (stock !== undefined) updates.stock = (stock === '' || stock === null) ? null : parseInt(stock, 10);
    if (is_active !== undefined) updates.is_active = (is_active === true || is_active === 'true');
    if (imageUrl !== undefined) updates.image_url = imageUrl;

    const result = await updateProgram(id, req.user.phone, req.user.role, updates);

    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      const statusMap = {
        'program_not_found': 404,
        'not_owner': 403,
        'no_fields_to_update': 400
      };
      const statusCode = statusMap[result.error] || 500;
      res.status(statusCode).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[BON ZORA ROUTES] Erreur PUT /programs/:id:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// DELETE /api/v1/bons-zora/programs/:id — Désactive une offre (is_active = false, propriétaire ou admin)
router.delete('/programs/:id', authMiddleware, requireProgramManager, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deactivateProgram(id, req.user.phone, req.user.role);

    if (result.success) {
      res.json({ success: true });
    } else {
      const statusMap = {
        'program_not_found': 404,
        'not_owner': 403
      };
      const statusCode = statusMap[result.error] || 500;
      res.status(statusCode).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[BON ZORA ROUTES] Erreur DELETE /programs/:id:', error.message);
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
