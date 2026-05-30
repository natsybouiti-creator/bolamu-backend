const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth.middleware');

// POST — Accorder un consentement
router.post('/:type', requireAuth, async (req, res) => {
  try {
    const validTypes = [
      'ordonnances', 'prescriptions_labo', 
      'historique_medecin', 'stats_employeur'
    ];
    if (!validTypes.includes(req.params.type)) {
      return res.status(400).json({ 
        success: false, message: 'Type de consentement invalide' 
      });
    }

    await db.query(
      `INSERT INTO patient_consents 
       (patient_id, consent_type, granted, granted_at)
       VALUES ($1,$2,true,NOW())
       ON CONFLICT (patient_id, consent_type)
       DO UPDATE SET granted=true, granted_at=NOW(), revoked_at=NULL`,
      [req.user.id, req.params.type]
    );

    res.json({ success: true, message: 'Consentement accordé' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE — Révoquer un consentement (effet immédiat)
router.delete('/:type', requireAuth, async (req, res) => {
  try {
    await db.query(
      `UPDATE patient_consents 
       SET granted=false, revoked_at=NOW()
       WHERE patient_id=$1 AND consent_type=$2`,
      [req.user.id, req.params.type]
    );

    res.json({ success: true, message: 'Consentement révoqué' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET — Lire ses consentements
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM patient_consents WHERE patient_id=$1`,
      [req.user.id]
    );
    res.json({ success: true, consents: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
