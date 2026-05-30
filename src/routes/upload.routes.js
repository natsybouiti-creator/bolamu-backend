const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const upload = require('../config/multer');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Secret pour les tokens d'upload (différent du secret JWT principal)
const UPLOAD_SECRET = process.env.UPLOAD_SECRET || crypto.randomBytes(32).toString('hex');

// POST /api/v1/upload/token - Génère un token d'upload temporaire
// Accepte un simple numéro de téléphone valide (pas de vérification OTP)
// car les documents sont uploadés AVANT la création du compte.
router.post('/token', async (req, res) => {
  try {
    const { phone } = req.body;

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

// POST /api/v1/upload/secure - Upload sécurisé de document
router.post('/secure', verifyUploadToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier fourni' });
    }

    console.log('[UPLOAD] Fichier uploadé:', req.file.filename);
    console.log('[UPLOAD] Sauvegarde dans DB...');

    // Trouver l'user_id correspondant au phone
    const userResult = await pool.query(
      'SELECT id FROM users WHERE phone = $1',
      [req.uploadPhone]
    );

    if (!userResult.rows.length) {
      console.log('[UPLOAD] User non trouvé pour phone:', req.uploadPhone);
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    const userId = userResult.rows[0].id;
    const storagePath = `/var/data/uploads/${req.file.filename}`;

    const result = await pool.query(
      `INSERT INTO documents 
       (owner_id, uploaded_by, document_type, filename, original_name, 
        mimetype, file_size, storage_path, created_at)
       VALUES ($1, $2, 'identite', $3, $4, $5, $6, $7, NOW())
       RETURNING id`,
      [userId, userId, req.file.filename, req.file.originalname, 
       req.file.mimetype, req.file.size, storagePath]
    );

    console.log('[UPLOAD] Résultat:', result.rows[0]);

    res.json({ success: true, file_id: result.rows[0].id });
  } catch (error) {
    console.error('[UPLOAD SECURE] Erreur:', error.message);
    console.error('[UPLOAD SECURE] Stack:', error.stack);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'upload' });
  }
});

module.exports = router;
