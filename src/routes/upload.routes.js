const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const cloudinary = require('../config/cloudinary');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const { normalizePhone } = require('../utils/phone');
const crypto = require('crypto');

// Secret pour les tokens d'upload (différent du secret JWT principal)
// En dev, utilise JWT_SECRET comme fallback
const UPLOAD_SECRET = process.env.UPLOAD_SECRET || process.env.JWT_SECRET || 'dev_upload_secret_change_in_prod';

// Multer avec memoryStorage (buffer en mémoire, pas sur disk)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

// POST /api/v1/upload/token - Génère un token d'upload temporaire
// Accepte un simple numéro de téléphone valide (pas de vérification OTP)
// car les documents sont uploadés AVANT la création du compte.
router.post('/token', async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone || '');

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Numéro de téléphone requis' });
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

// Upload vers Cloudinary en mode privé
const uploadToCloudinary = (buffer, mimetype) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'bolamu/documents',
        resource_type: 'auto',
        type: 'authenticated',
        access_mode: 'authenticated'
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
};

// POST /api/v1/upload/secure - Upload sécurisé de document
// Upload AVANT création de compte - stockage temporaire avec phone comme uploaded_by
router.post('/secure', verifyUploadToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, message: 'Aucun fichier reçu' 
      });
    }

    console.log('[UPLOAD] Fichier reçu:', req.file.originalname);

    const result = await uploadToCloudinary(
      req.file.buffer, 
      req.file.mimetype
    );

    console.log('[UPLOAD] Cloudinary OK:', result.public_id);

    await pool.query(
      `INSERT INTO documents 
       (owner_id, uploaded_by, document_type, filename, 
        original_name, mimetype, storage_path, file_size, created_at)
       VALUES (NULL, $1, 'identite', $2, $3, $4, $5, $6, NOW())
       RETURNING id`,
      [
        req.uploadPhone,
        result.public_id,
        req.file.originalname,
        req.file.mimetype,
        result.secure_url,
        result.bytes
      ]
    );

    console.log('[UPLOAD] Sauvegardé en DB');

    res.json({ 
      success: true, 
      fileId: result.public_id,
      url: result.secure_url
    });

  } catch (err) {
    console.error('[UPLOAD SECURE] Erreur:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
