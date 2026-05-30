const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const cloudinary = require('../config/cloudinary');

const { requireAdmin } = require('../middleware/auth.middleware');

// GET /api/v1/admin/documents/:fileId - Générer une signed URL temporaire
router.get('/documents/:fileId', requireAdmin, async (req, res) => {
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
      const signedUrl = cloudinary.utils.private_download_url(
        doc.filename,
        doc.mimetype?.split('/')[1] || 'jpg',
        {
          resource_type: doc.mimetype?.startsWith('video') ? 'video' : 'image',
          expires_at: Math.floor(Date.now() / 1000) + 300 // 5 minutes
        }
      );

      return res.json({ 
        success: true, 
        url: signedUrl,
        expires_in: 300,
        source: 'cloudinary'
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
