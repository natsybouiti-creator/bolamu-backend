const express = require('express');
const router = express.Router();
const pool = require('../config/db');

const authMiddleware = require('../middleware/auth.middleware');

// GET /api/v1/admin/documents/:fileId - Retourne le storage_path direct
router.get('/documents/:fileId', authMiddleware.requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM documents WHERE id=$1 AND is_deleted=false`,
      [parseInt(req.params.fileId)]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Document introuvable' });
    }

    const doc = result.rows[0];
    return res.json({ success: true, url: doc.storage_path });
  } catch (err) {
    console.error('[DOCUMENTS] Erreur:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
