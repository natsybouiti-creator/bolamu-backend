const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middleware/auth.middleware');
const { bhpAccessMiddleware, logAccessAttempt } = require('../middleware/bhpAccess');
const { awardZora } = require('../services/zora.service');
const { normalizePhone } = require('../utils/phone');

// POST — Créer un enregistrement médical
// Rôles : doctor uniquement (TC-033 : pharmacie/laboratoire interdits)
router.post('/',
  authMiddleware,
  bhpAccessMiddleware(['doctor']),
  async (req, res) => {
    try {
      let {
        patient_id, patient_phone, record_type, title,
        content, company_id, consent_granted
      } = req.body;

      // phone comme identifiant universel : le frontend (dashboards pro) ne
      // connaît que le phone, jamais l'id numérique de health_records.
      // patient_id reste accepté pour compatibilité, patient_phone est résolu
      // en priorité s'il est fourni.
      if (patient_phone) {
        const phone = normalizePhone(patient_phone);
        const patientRes = await db.query(`SELECT id FROM users WHERE phone = $1 AND role = 'patient'`, [phone]);
        if (!patientRes.rows.length) {
          return res.status(404).json({ success: false, message: 'Patient introuvable.' });
        }
        patient_id = patientRes.rows[0].id;
      }

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

      const record = result.rows[0];

      // BHP : journalisation de la création, jamais loguée par
      // bhpAccessMiddleware pour un POST (pas de recordId au moment du rôle-check).
      logAccessAttempt(record.id, req.user, 'CREATE_' + String(record_type || '').toUpperCase(), req.ip).catch(() => {});

      // Crédit Zora — vaccination uniquement (carnet de vaccination, ground_truth
      // car acte réalisé par un médecin). Les autres record_type ne déclenchent
      // rien ici (leur éventuel crédit suit un autre flux, ex. consultation via
      // appointments).
      if (record_type === 'vaccination') {
        try {
          const patientRes = await db.query(`SELECT phone FROM users WHERE id = $1`, [patient_id]);
          if (patientRes.rows.length) {
            await awardZora({
              phone: patientRes.rows[0].phone,
              action_type: 'vaccination',
              proof_class: 'ground_truth',
              proof_source: 'doctor',
              recording_method: null,
              proof_reference: 'hr_' + record.id
            });
          }
        } catch (zoraErr) {
          console.error('[ZORA] Erreur crédit vaccination (doctor):', zoraErr.message);
        }
      }

      res.status(201).json({
        success: true,
        record
      });
    } catch (err) {
      console.error('[HEALTH_RECORDS] Erreur POST:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// GET — Lire le carnet de santé d'un patient
// Rôles : patient (le sien), doctor (consentement requis par BHP v1.2)
router.get('/patient/:patientId',
  authMiddleware,
  bhpAccessMiddleware(['patient', 'doctor', 'admin']),
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

      // BHP v1.2 : doctor ne voit que les enregistrements
      // pour lesquels le patient a accordé son consentement (consent_granted = true).
      // Patient et admin voient tout (patient = ses propres données, admin = supervision).
      const requiresConsent = req.user.role === 'doctor';
      const result = await db.query(
        `SELECT * FROM health_records
         WHERE patient_id=$1
           AND is_deleted=false
           ${requiresConsent ? 'AND consent_granted = true' : ''}
         ORDER BY created_at DESC LIMIT 200`,
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
  authMiddleware,
  bhpAccessMiddleware([
    'patient', 'doctor', 'admin'
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
  authMiddleware,
  bhpAccessMiddleware(['patient', 'admin']),
  async (req, res) => {
    const client = await db.connect();
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
  authMiddleware,
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
