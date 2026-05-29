const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const upload = require('../config/multer');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Secret pour les tokens d'upload (différent du secret JWT principal)
const UPLOAD_SECRET = process.env.UPLOAD_SECRET || crypto.randomBytes(32).toString('hex');

// POST /api/v1/upload/token - Génère un token d'upload temporaire
router.post('/token', async (req, res) => {
  try {
    const { phone, otp_verified } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Numéro de téléphone requis' });
    }

    // Vérifier que l'OTP a été validé pour ce numéro
    // Pour simplifier, on accepte la demande si otp_verified est true
    // En production, on vérifierait dans Redis ou une table temporaire
    if (!otp_verified) {
      return res.status(400).json({ success: false, message: 'OTP non validé' });
    }

    // Générer un token JWT valide 30 minutes
    const uploadToken = jwt.sign(
      { phone, type: 'upload' },
      UPLOAD_SECRET,
      { expiresIn: '30m' }
    );

    res.json({ success: true, upload_token: uploadToken });
  } catch (error) {
    console.error('[UPLOAD TOKEN] Erreur:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Middleware pour vérifier le token d'upload
const verifyUploadToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Token manquant' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, UPLOAD_SECRET);

    if (decoded.type !== 'upload') {
      return res.status(401).json({ success: false, message: 'Token invalide' });
    }

    req.uploadPhone = decoded.phone;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token invalide ou expiré' });
  }
};

// POST /api/v1/upload/secure - Upload sécurisé de document
router.post('/secure', verifyUploadToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier fourni' });
    }

    const fileId = crypto.randomUUID();

    // Enregistrer les métadonnées en base
    await pool.query(
      `INSERT INTO documents (file_id, filename, original_name, mimetype, size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [fileId, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, req.uploadPhone]
    );

    res.json({ success: true, file_id: fileId });
  } catch (error) {
    console.error('[UPLOAD SECURE] Erreur:', error.message);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'upload' });
  }
});

module.exports = router;
