const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth.middleware');
const { bhpAccessMiddleware } = require('../middleware/bhpAccess');

// POST — Créer un enregistrement médical
// Rôles : medecin, pharmacie, laboratoire
router.post('/',
  requireAuth,
  bhpAccessMiddleware(['medecin', 'pharmacie', 'laboratoire']),
  async (req, res) => {
    try {
      const { 
        patient_id, record_type, title, 
        content, company_id, consent_granted 
      } = req.body;

      const result = await db.query(
        `INSERT INTO health_records 
         (patient_id, record_type, title, content, 
          source_role, source_user_id, company_id, 
          consent_granted, consent_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
         RETURNING *`,
        [patient_id, record_type, title, 
         JSON.stringify(content), req.user.role, 
         req.user.id, company_id || null, 
         consent_granted || false]
      );

      res.status(201).json({ 
        success: true, 
        record: result.rows[0] 
      });
    } catch (err) {
      console.error('[HEALTH_RECORDS] Erreur POST:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// GET — Lire le carnet de santé d'un patient
// Rôles : patient (le sien), medecin (avec consentement)
router.get('/patient/:patientId',
  requireAuth,
  bhpAccessMiddleware(['patient', 'medecin', 'cms_medecin', 'admin']),
  async (req, res) => {
    try {
      const { patientId } = req.params;

      // Patient ne peut voir que son propre dossier
      if (req.user.role === 'patient' && 
          req.user.id !== patientId) {
        return res.status(403).json({ 
          success: false, 
          error: 'BHP_ACCESS_DENIED' 
        });
      }

      const result = await db.query(
        `SELECT * FROM health_records
         WHERE patient_id=$1 AND is_deleted=false
         ORDER BY created_at DESC`,
        [patientId]
      );

      res.json({ success: true, records: result.rows });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// GET — Lire un enregistrement précis
router.get('/:id',
  requireAuth,
  bhpAccessMiddleware([
    'patient', 'medecin', 'pharmacie', 
    'laboratoire', 'admin'
  ]),
  async (req, res) => {
    try {
      const result = await db.query(
        'SELECT * FROM health_records WHERE id=$1 AND is_deleted=false',
        [req.params.id]
      );
      if (!result.rows.length) {
        return res.status(404).json({ 
          success: false, message: 'Enregistrement introuvable' 
        });
      }
      res.json({ success: true, record: result.rows[0] });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// DELETE — Soft delete uniquement (jamais physique avant 5 ans)
router.delete('/:id',
  requireAuth,
  bhpAccessMiddleware(['patient', 'admin']),
  async (req, res) => {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      
      await client.query(
        `UPDATE health_records 
         SET is_deleted=true, updated_at=NOW() 
         WHERE id=$1`,
        [req.params.id]
      );

      await client.query(
        `INSERT INTO health_record_access_log
         (record_id, accessed_by, role_at_access, 
          access_reason, ip_address)
         VALUES ($1,$2,$3,'SOFT_DELETE_REQUESTED',$4)`,
        [req.params.id, req.user.id, req.user.role, req.ip]
      );

      await client.query('COMMIT');
      res.json({ 
        success: true, 
        message: 'Donnée masquée. Effacement physique dans 5 ans.' 
      });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ success: false, message: err.message });
    } finally {
      client.release();
    }
  }
);

// GET — Historique accès à un dossier (droit loi 29-2019)
router.get('/access-log/:recordId',
  requireAuth,
  bhpAccessMiddleware(['patient', 'admin']),
  async (req, res) => {
    try {
      const result = await db.query(
        `SELECT l.*, u.phone as accessed_by_phone
         FROM health_record_access_log l
         JOIN users u ON l.accessed_by = u.id
         WHERE l.record_id=$1
         ORDER BY l.accessed_at DESC`,
        [req.params.recordId]
      );
      res.json({ success: true, logs: result.rows });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

module.exports = router;
