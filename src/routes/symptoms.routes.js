// ============================================================
// BOLAMU — Routes Symptômes pre-RDV (Sprint 9)
// ============================================================
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const pool = require('../config/db');

// Middleware pour vérifier que l'utilisateur est un patient
function patientOnly(req, res, next) {
  if (req.user?.role !== 'patient') {
    return res.status(403).json({ success: false, message: 'Accès réservé aux patients.' });
  }
  next();
}

// Middleware pour vérifier que l'utilisateur est un patient ou un médecin
function patientOrDoctorOnly(req, res, next) {
  if (!['patient', 'doctor'].includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: 'Accès réservé aux patients et médecins.' });
  }
  next();
}

// ============================================================
// POST /api/v1/appointments/:id/symptoms
// Enregistrer les symptômes pour un RDV (patient uniquement)
// ============================================================
router.post('/appointments/:id/symptoms', authMiddleware, patientOnly, async (req, res) => {
  const { id } = req.params;
  const { motif, symptomes, duree_symptomes, intensite, traitements_en_cours, remarques_patient } = req.body;

  if (!motif) {
    return res.status(400).json({ success: false, message: 'Motif requis' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO appointment_symptoms 
       (appointment_id, motif, symptomes, duree_symptomes, intensite, traitements_en_cours, remarques_patient)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, motif, JSON.stringify(symptomes || []), duree_symptomes, intensite, traitements_en_cours, remarques_patient]
    );

    return res.json({
      success: true,
      message: 'Symptômes enregistrés avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[SYMPTOMS POST]', error.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ============================================================
// GET /api/v1/appointments/:id/symptoms
// Récupérer les symptômes d'un RDV (patient ou médecin)
// ============================================================
router.get('/appointments/:id/symptoms', authMiddleware, patientOrDoctorOnly, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM appointment_symptoms WHERE appointment_id = $1`,
      [id]
    );

    if (!result.rows.length) {
      return res.json({ success: true, data: null });
    }

    return res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[SYMPTOMS GET]', error.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ============================================================
// PUT /api/v1/appointments/:id/symptoms
// Mettre à jour les symptômes d'un RDV (patient uniquement, avant date RDV)
// ============================================================
router.put('/appointments/:id/symptoms', authMiddleware, patientOnly, async (req, res) => {
  const { id } = req.params;
  const { motif, symptomes, duree_symptomes, intensite, traitements_en_cours, remarques_patient } = req.body;

  try {
    // Vérifier que le RDV n'est pas encore passé
    const appointmentCheck = await pool.query(
      `SELECT appointment_time FROM appointments WHERE id = $1`,
      [id]
    );

    if (!appointmentCheck.rows.length) {
      return res.status(404).json({ success: false, message: 'RDV introuvable' });
    }

    const appointmentTime = new Date(appointmentCheck.rows[0].appointment_time);
    const now = new Date();

    if (appointmentTime < now) {
      return res.status(400).json({ success: false, message: 'Impossible de modifier les symptômes après la date du RDV' });
    }

    const result = await pool.query(
      `UPDATE appointment_symptoms 
       SET motif = $1, symptomes = $2, duree_symptomes = $3, intensite = $4, 
           traitements_en_cours = $5, remarques_patient = $6
       WHERE appointment_id = $7
       RETURNING *`,
      [motif, JSON.stringify(symptomes || []), duree_symptomes, intensite, traitements_en_cours, remarques_patient, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Symptômes introuvables' });
    }

    return res.json({
      success: true,
      message: 'Symptômes mis à jour avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[SYMPTOMS PUT]', error.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
