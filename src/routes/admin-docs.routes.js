const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const path = require('path');
const fs = require('fs');

const { requireAdmin } = require('../middleware/auth.middleware');

// GET /api/v1/admin/documents/:fileId - Servir un document à l'admin
router.get('/documents/:fileId', requireAdmin, async (req, res) => {
  try {
    // Cherche d'abord dans la nouvelle table documents
    let result = await pool.query(
      `SELECT * FROM documents WHERE id=$1 AND is_deleted=false`,
      [req.params.fileId]
    );

    // Fallback sur l'ancienne table uploads si pas trouvé
    if (!result.rows.length) {
      result = await pool.query(
        `SELECT filename, mimetype, original_name,
                '/var/data/uploads/' || filename as storage_path
         FROM uploads WHERE id=$1`,
        [req.params.fileId]
      );
    }

    if (!result.rows.length) {
      return res.status(404).json({ 
        success: false, message: 'Document introuvable en base' 
      });
    }

    const doc = result.rows[0];
    const filePath = doc.storage_path || 
                     `/var/data/uploads/${doc.filename}`;

    console.log('[DOCUMENTS] Chemin:', filePath);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        success: false, 
        message: 'Fichier introuvable sur le disque',
        filename: doc.filename
      });
    }

    res.setHeader(
      'Content-Disposition', 
      `inline; filename="${doc.original_name || doc.filename}"` 
    );
    res.setHeader('Content-Type', doc.mimetype || 'application/octet-stream');
    res.sendFile(filePath);

  } catch (err) {
    console.error('[DOCUMENTS] Erreur:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
