const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const path = require('path');
const fs = require('fs');

const { requireAdmin } = require('../middleware/auth.middleware');

// GET /api/v1/admin/documents/:fileId - Servir un document à l'admin
router.get('/documents/:fileId', requireAdmin, async (req, res) => {
  try {
    const { fileId } = req.params;
    console.log('[DOCUMENTS] fileId:', fileId);
    console.log('[DOCUMENTS] Requête SQL lancée...');

    // Récupérer les métadonnées du document
    const { rows } = await pool.query(
      'SELECT filename, mimetype, original_name FROM documents WHERE file_id = $1',
      [fileId]
    );

    console.log('[DOCUMENTS] Résultat DB:', rows);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document non trouvé' });
    }

    const doc = rows[0];

    // Déterminer le chemin du fichier avec fallback
    const uploadDir = process.env.NODE_ENV === 'production' 
      && fs.existsSync('/var/data')
        ? '/var/data/uploads/documents' 
        : path.join(process.cwd(), 'uploads', 'documents');
    
    const filePath = path.join(uploadDir, doc.filename);

    // Vérifier que le fichier existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Fichier non trouvé sur le serveur' });
    }

    // Servir le fichier avec des headers de sécurité
    res.setHeader('Content-Disposition', `inline; filename="${doc.original_name}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(filePath);
  } catch (error) {
    console.log('[DOCUMENTS] Erreur SQL:', error.message);
    console.log('[DOCUMENTS] Erreur détail:', error.detail);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
