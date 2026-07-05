// ============================================================
// BOLAMU — Routes Catalogue SSP (Soins de Santé Primaires)
// Expose ssp_catalog (migration_034) aux dashboards — remplace les
// tableaux CATALOGUE_SSP codés en dur (secretaire/agence).
// ============================================================
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth.middleware');
const { isSSPFreeText } = require('../services/smartflow.service');

// ─── GET /api/v1/ssp-catalog — liste complète (filtre type optionnel) ────────
router.get('/', authMiddleware, async (req, res) => {
    const { type } = req.query;
    try {
        const params = [];
        let query = `SELECT id, type, nom, categorie, est_ssp, description FROM ssp_catalog WHERE 1=1`;
        if (type) {
            query += ` AND type = $1`;
            params.push(type);
        }
        query += ` ORDER BY categorie, nom`;
        const result = await pool.query(query, params);
        return res.json({ success: true, data: result.rows });
    } catch (e) {
        console.error('[GET /ssp-catalog]', e.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ─── GET /api/v1/ssp-catalog/check?nom=&type= — vérification ponctuelle ──────
router.get('/check', authMiddleware, async (req, res) => {
    const { nom, type } = req.query;
    if (!nom) {
        return res.status(400).json({ success: false, message: 'Paramètre nom requis.' });
    }
    try {
        const result = await isSSPFreeText(nom, type || null);
        return res.json({ success: true, data: result });
    } catch (e) {
        console.error('[GET /ssp-catalog/check]', e.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
