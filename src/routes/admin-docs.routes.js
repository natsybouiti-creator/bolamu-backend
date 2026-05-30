const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const cloudinary = require('../config/cloudinary');

const authMiddleware = require('../middleware/auth.middleware');

// GET /api/v1/admin/documents/:fileId - Générer une signed URL temporaire
router.get('/documents/:fileId', authMiddleware.requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM documents WHERE id=$1 AND is_deleted=false`,
      [req.params.fileId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ 
        success: false, message: 'Document introuvable' 
      });
    }

    const doc = result.rows[0];

    // Si storage_path contient cloudinary.com, générer une signed URL
    if (doc.storage_path && doc.storage_path.includes('cloudinary.com')) {
      const extension = doc.mimetype?.split('/')[1] || 'jpg';
      const signedUrl = cloudinary.url(doc.filename, {
        resource_type: 'image',
        type: 'authenticated',
        sign_url: true,
        expires_at: Math.floor(Date.now() / 1000) + 300,
        format: extension
      });

      return res.json({ 
        success: true, 
        url: signedUrl,
        expires_in: 300
      });
    }

    // Fallback pour fichiers locaux (ancien système)
    return res.json({ 
      success: true, 
      url: doc.storage_path,
      source: 'local'
    });

  } catch (err) {
    console.error('[DOCUMENTS] Erreur:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
