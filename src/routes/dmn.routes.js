'use strict';
// ============================================================
// BOLAMU — DMN : Dossier Médical Numérique (BHP v1.2)
// Routes sécurisées — patient uniquement pour ses propres données
// ============================================================
const express    = require('express');
const router     = express.Router();
const pool       = require('../config/db');
const cloudinary = require('../config/cloudinary');
const authMiddleware         = require('../middleware/auth.middleware');
const { strictLimiter }      = require('../middleware/rateLimiter');
const { normalizePhone }     = require('../utils/phone');
const {
  getFullDossier,
  verifyPatientPassword,
  verifyDmnToken,
  verifyQrToken,
  generateQRPayload,
  hasDmnQrConsent,
  getVaccinationCarnet,
  logAccess
} = require('../services/dmn.service');

// Middleware — patient uniquement, jamais croisé
const requirePatient = (req, res, next) => {
  if (!req.user || req.user.role !== 'patient') {
    return res.status(403).json({ success: false, error: 'BHP_ACCESS_DENIED' });
  }
  next();
};

// Middleware — professionnel de santé authentifié uniquement (scan QR dossier).
// Mêmes rôles que PARTENAIRE_ROLES (bon-zora.routes.js) — décision produit :
// jamais de scan anonyme pour ce flux, contrairement au QR urgence, car le
// dossier DMN expose plus que le strict minimum vital (RDV, documents, historique).
const PROFESSIONNEL_SANTE_ROLES = ['pharmacie', 'doctor', 'laboratoire'];
const requireProfessionnelSante = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, error: 'non_authentifie' });
  if (!PROFESSIONNEL_SANTE_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'acces_reserve_professionnel_sante' });
  }
  next();
};

// ─────────────────────────────────────────────────────────────
// GET /api/v1/dmn/summary
// Résumé complet du dossier (patient connecté = son propre dossier)
// ─────────────────────────────────────────────────────────────
router.get('/summary', authMiddleware, requirePatient, async (req, res) => {
  const phone = normalizePhone(req.user.phone);
  try {
    const dossier = await getFullDossier(phone);
    // BHP : log obligatoire sur TOUT accès
    logAccess(phone, phone, 'consultation', { source: 'summary' }, req.ip).catch(() => {});
    res.json({ success: true, data: dossier });
  } catch (err) {
    console.error('[DMN] summary:', err.message);
    if (err.message === 'Patient introuvable') {
      return res.status(404).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/dmn/download/verify
// Vérifie le mot de passe patient, retourne token DMN 15 min.
// Rate limiting strict : 5 tentatives / 15 min (CHANTIER 4).
// ─────────────────────────────────────────────────────────────
router.post('/download/verify', authMiddleware, requirePatient, strictLimiter, async (req, res) => {
  const phone = normalizePhone(req.user.phone);
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ success: false, message: 'Mot de passe requis' });
  }

  try {
    const result = await verifyPatientPassword(phone, password, req.ip);
    logAccess(phone, phone, 'download', { action: 'password_verified' }, req.ip).catch(() => {});
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.code === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ success: false, message: 'Mot de passe incorrect' });
    }
    console.error('[DMN] download/verify:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/dmn/download/:document_id
// Téléchargement sécurisé via token DMN 15 min.
// Jamais de lien direct permanent.
// Documents stockés dans Cloudinary (authenticated) — URL signée 60s.
// ─────────────────────────────────────────────────────────────
router.get('/download/:document_id', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token DMN requis' });
  }

  let decoded;
  try {
    decoded = verifyDmnToken(authHeader.substring(7));
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token DMN invalide ou expiré' });
  }

  const phone      = normalizePhone(decoded.phone);
  const documentId = parseInt(req.params.document_id, 10);
  if (isNaN(documentId)) {
    return res.status(400).json({ success: false, message: 'document_id invalide' });
  }

  try {
    const docRes = await pool.query(
      `SELECT id, filename, original_name, mimetype, storage_path
       FROM documents
       WHERE id = $1 AND uploaded_by = $2`,
      [documentId, phone]
    );

    if (!docRes.rows.length) {
      return res.status(404).json({ success: false, message: 'Document introuvable ou accès refusé' });
    }

    const doc = docRes.rows[0];

    // BHP : log obligatoire sur tout téléchargement
    logAccess(phone, phone, 'download', {
      document_id: documentId,
      filename:    doc.original_name
    }, req.ip).catch(() => {});

    // Log dans document_downloads
    pool.query(
      `INSERT INTO document_downloads (patient_phone, document_id, ip_address, verified_at, status)
       VALUES ($1, $2, $3, NOW(), 'verified')`,
      [phone, documentId, req.ip || null]
    ).catch(() => {});

    // Générer URL signée Cloudinary (60s) — jamais de lien permanent
    const expiresAt = Math.floor(Date.now() / 1000) + 60;
    const signedUrl = cloudinary.url(doc.filename, {
      sign_url:      true,
      type:          'authenticated',
      expires_at:    expiresAt,
      attachment:    true,
      resource_type: 'auto'
    });

    res.json({ success: true, download_url: signedUrl, expires_in: 60 });
  } catch (err) {
    console.error('[DMN] download/:id:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/dmn/qr-payload
// Payload BHP minimal signé JWT 24h pour génération QR côté frontend.
// ─────────────────────────────────────────────────────────────
router.get('/qr-payload', authMiddleware, requirePatient, async (req, res) => {
  const phone = normalizePhone(req.user.phone);
  try {
    const result = await generateQRPayload(phone);
    logAccess(phone, phone, 'qr_scan', { action: 'qr_generated' }, req.ip).catch(() => {});
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[DMN] qr-payload:', err.message);
    if (err.message === 'Patient introuvable') {
      return res.status(404).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/dmn/verify?token=...
// Vérifie un QR dossier scanné par un professionnel de santé authentifié
// (doctor/pharmacie/laboratoire). Jamais de scan anonyme pour ce flux.
// 401 = token invalide/malformé, 403 = rôle non autorisé, 410 = expiré.
// ─────────────────────────────────────────────────────────────
router.get('/verify', authMiddleware, requireProfessionnelSante, async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ success: false, message: 'Token requis' });
  }

  let decoded;
  try {
    decoded = verifyQrToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(410).json({ success: false, message: 'QR dossier expiré' });
    }
    return res.status(401).json({ success: false, message: 'QR dossier invalide' });
  }

  try {
    // BHP v1.2 : le patient doit avoir un consentement actif (accordé à la génération
    // du QR, révocable à tout moment) avant qu'un professionnel n'accède au dossier complet.
    const consented = await hasDmnQrConsent(decoded.patient_phone);
    if (!consented) {
      return res.status(403).json({ success: false, message: 'Consentement patient absent ou révoqué pour ce dossier' });
    }

    const dossier = await getFullDossier(decoded.patient_phone);
    // BHP : log obligatoire — accessor_phone = le professionnel authentifié, jamais null ici.
    logAccess(decoded.patient_phone, req.user.phone, 'qr_scan_verified', { scanner_role: req.user.role }, req.ip).catch(() => {});
    res.json({ success: true, data: dossier });
  } catch (err) {
    console.error('[DMN] verify:', err.message);
    if (err.message === 'Patient introuvable') {
      return res.status(404).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/dmn/access-log
// 20 derniers accès au dossier (droit de traçabilité BHP / Loi 29-2019)
// ─────────────────────────────────────────────────────────────
router.get('/access-log', authMiddleware, requirePatient, async (req, res) => {
  const phone = normalizePhone(req.user.phone);
  try {
    const result = await pool.query(
      `SELECT access_type, accessor_phone, accessed_at, details
       FROM dmn_access_log
       WHERE patient_phone = $1
       ORDER BY accessed_at DESC LIMIT 20`,
      [phone]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[DMN] access-log:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/dmn/vaccinations/:phone
// Carnet de vaccination complet (health_records médecin + vaccination_attestations
// pharmacie/laboratoire). Accès : le patient lui-même, un professionnel avec
// relation de soin active, ou un admin. Jamais de phone en query param nu —
// toujours vérifié via req.user avant toute requête.
// ─────────────────────────────────────────────────────────────
router.get('/vaccinations/:phone', authMiddleware, async (req, res) => {
  const phone = normalizePhone(req.params.phone || '');
  const userPhone = normalizePhone(req.user?.phone || '');
  const userRole = req.user?.role;

  try {
    const isPatient = userPhone === phone;
    const isAdmin = userRole === 'admin' || userRole === 'content_admin';

    let isTreatingDoctor = false;
    if (!isPatient && !isAdmin && userRole === 'doctor') {
      const check = await pool.query(
        `SELECT COUNT(*) FROM appointments
         WHERE patient_phone = $1 AND doctor_id = (SELECT id FROM doctors WHERE phone = $2)`,
        [phone, userPhone]
      );
      isTreatingDoctor = parseInt(check.rows[0].count) > 0;
    }

    let isTreatingPro = false;
    if (!isPatient && !isAdmin && !isTreatingDoctor && ['pharmacie', 'laboratoire'].includes(userRole)) {
      const check = await pool.query(
        `SELECT COUNT(*) FROM vaccination_attestations
         WHERE patient_phone = $1 AND professionnel_phone = $2`,
        [phone, userPhone]
      );
      isTreatingPro = parseInt(check.rows[0].count) > 0;
    }

    if (!isPatient && !isAdmin && !isTreatingDoctor && !isTreatingPro) {
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }

    const carnet = await getVaccinationCarnet(phone);

    logAccess(phone, userPhone, 'consultation', { source: 'vaccinations_carnet' }, req.ip).catch(() => {});

    return res.json({ success: true, data: carnet });
  } catch (err) {
    console.error('[DMN] vaccinations:', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/dmn/update
// Mise à jour dossier médical par le patient.
// Champs autorisés uniquement. Log accès. Crédit Zora 30 pts.
// ─────────────────────────────────────────────────────────────
const ALLOWED_FIELDS = [
  'groupe_sanguin', 'allergies', 'maladies_chroniques',
  'antecedents_medicaux', 'traitements_en_cours',
  'poids', 'taille',
  'contact_urgence_nom', 'contact_urgence_phone', 'contact_urgence_lien'
];

router.post('/update', authMiddleware, requirePatient, async (req, res) => {
  const phone   = normalizePhone(req.user.phone);
  const updates = [];
  const values  = [phone];

  for (const key of ALLOWED_FIELDS) {
    if (req.body[key] !== undefined) {
      updates.push(`${key} = $${values.length + 1}`);
      values.push(req.body[key]);
    }
  }

  if (!updates.length) {
    return res.status(400).json({ success: false, message: 'Aucun champ autorisé fourni' });
  }

  // normalizePhone sur contact_urgence_phone
  const cpIdx = ALLOWED_FIELDS.indexOf('contact_urgence_phone') + 1;
  if (req.body.contact_urgence_phone) {
    const normalized = normalizePhone(req.body.contact_urgence_phone);
    if (!normalized) {
      return res.status(400).json({ success: false, message: 'contact_urgence_phone invalide' });
    }
    const valueIdx = values.findIndex(v => v === req.body.contact_urgence_phone);
    if (valueIdx !== -1) values[valueIdx] = normalized;
  }

  try {
    // UPDATE users — même pattern que constantes-medicales.controller.js
    await pool.query(
      `UPDATE users
       SET ${updates.join(', ')}, constantes_remplies_par = 'patient', constantes_updated_at = NOW()
       WHERE phone = $1`,
      values
    );

    // BHP : log obligatoire
    logAccess(phone, phone, 'update', { fields: updates.map(u => u.split(' = ')[0]) }, req.ip).catch(() => {});

    // Crédit Zora dossier_update : déplacé vers constantes-medicales.controller.js
    // (updateConstantesPatient) — la seule route réellement appelée par le
    // frontend (A.saveConst()). Cette route /dmn/update n'est appelée par aucun
    // client connu ; le crédit ici était donc mort (jamais exécuté en prod).

    res.json({ success: true, message: 'Dossier mis à jour' });
  } catch (err) {
    console.error('[DMN] update:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
