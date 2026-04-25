const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../../middleware/auth.middleware');

// Adjectifs prédéfinis
const ADJECTIVES_POSITIVE = ['Professionnel', 'Ponctuel', 'Attentionné', 'Compétent', 'Rassurant', 'Rapide', 'Clair', 'Efficace'];
const ADJECTIVES_NEGATIVE = ['Impoli', 'En retard', 'Négligent', 'Peu clair', 'Pressé', 'Froid', 'Absent'];

// POST /api/v1/ratings/submit — patient soumet une note
router.post('/submit', authMiddleware, async (req, res) => {
  const { patient_phone, intervenant_phone, intervenant_role, action_type, action_id, stars, adjectives } = req.body;
  if (!patient_phone || !intervenant_phone || !intervenant_role || !action_type || !action_id || !stars) {
    return res.status(400).json({ success: false, message: 'Champs manquants' });
  }
  if (stars < 1 || stars > 5) {
    return res.status(400).json({ success: false, message: 'Note entre 1 et 5' });
  }
  try {
    await pool.query(
      `INSERT INTO ratings (patient_phone, intervenant_phone, intervenant_role, action_type, action_id, stars, adjectives)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (patient_phone, action_type, action_id) DO NOTHING`,
      [patient_phone, intervenant_phone, intervenant_role, action_type, action_id, stars, adjectives || []]
    );
    res.json({ success: true, message: 'Merci pour votre évaluation' });
  } catch(e) {
    console.error('[ratings/submit]', e.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/v1/ratings/pending/:phone — actions récentes non notées par le patient
router.get('/pending/:phone', authMiddleware, async (req, res) => {
  const { phone } = req.params;
  try {
    const pending = [];

    // Consultations terminées non notées (48h)
    const consultations = await pool.query(
      `SELECT a.id, a.validated_at, d.phone as intervenant_phone, d.full_name as intervenant_name, 'consultation' as action_type
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       WHERE a.patient_phone = $1
       AND a.status = 'termine'
       AND a.validated_at > NOW() - INTERVAL '48 hours'
       AND NOT EXISTS (
         SELECT 1 FROM ratings r
         WHERE r.patient_phone = $1 AND r.action_type = 'consultation' AND r.action_id = a.id
       )`,
      [phone]
    );
    pending.push(...consultations.rows.map(r => ({ ...r, intervenant_role: 'doctor' })));

    // Délivrances pharmacie non notées (48h)
    const delivrances = await pool.query(
      `SELECT p.id, p.delivered_at as validated_at, p.pharmacie_phone as intervenant_phone,
       u.full_name as intervenant_name, 'delivrance' as action_type
       FROM prescriptions p
       JOIN users u ON u.phone = p.pharmacie_phone
       WHERE p.patient_phone = $1
       AND p.status = 'delivered'
       AND p.delivered_at > NOW() - INTERVAL '48 hours'
       AND NOT EXISTS (
         SELECT 1 FROM ratings r
         WHERE r.patient_phone = $1 AND r.action_type = 'delivrance' AND r.action_id = p.id
       )`,
      [phone]
    );
    pending.push(...delivrances.rows.map(r => ({ ...r, intervenant_role: 'pharmacie' })));

    // Résultats labo non notés (48h)
    const labResults = await pool.query(
      `SELECT lr.id, lr.created_at as validated_at, lr.lab_phone as intervenant_phone,
       u.full_name as intervenant_name, 'labo' as action_type
       FROM lab_results lr
       JOIN users u ON u.phone = lr.lab_phone
       WHERE lr.patient_phone = $1
       AND lr.created_at > NOW() - INTERVAL '48 hours'
       AND NOT EXISTS (
         SELECT 1 FROM ratings r
         WHERE r.patient_phone = $1 AND r.action_type = 'labo' AND r.action_id = lr.id
       )`,
      [phone]
    );
    pending.push(...labResults.rows.map(r => ({ ...r, intervenant_role: 'laboratoire' })));

    res.json({ success: true, data: pending, adjectives_positive: ADJECTIVES_POSITIVE, adjectives_negative: ADJECTIVES_NEGATIVE });
  } catch(e) {
    console.error('[ratings/pending]', e.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/v1/ratings/intervenant/:phone — stats d'un intervenant
router.get('/intervenant/:phone', authMiddleware, async (req, res) => {
  const { phone } = req.params;
  try {
    const stats = await pool.query(
      `SELECT
         COUNT(*) as total_ratings,
         ROUND(AVG(stars), 1) as moyenne,
         COUNT(CASE WHEN stars >= 4 THEN 1 END) as positifs,
         COUNT(CASE WHEN stars <= 2 THEN 1 END) as negatifs,
         array_agg(DISTINCT unnest(adjectives)) as all_adjectives
       FROM ratings WHERE intervenant_phone = $1`,
      [phone]
    );
    const recent = await pool.query(
      `SELECT stars, adjectives, action_type, created_at
       FROM ratings WHERE intervenant_phone = $1
       ORDER BY created_at DESC LIMIT 10`,
      [phone]
    );
    res.json({ success: true, stats: stats.rows[0], recent: recent.rows });
  } catch(e) {
    console.error('[ratings/intervenant]', e.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/v1/ratings/admin/all — vue globale admin
router.get('/admin/all', authMiddleware, async (req, res) => {
  try {
    const classement = await pool.query(
      `SELECT
         r.intervenant_phone,
         r.intervenant_role,
         u.full_name,
         COUNT(*) as total_ratings,
         ROUND(AVG(r.stars), 1) as moyenne,
         COUNT(CASE WHEN r.stars <= 2 THEN 1 END) as alertes
       FROM ratings r
       JOIN users u ON u.phone = r.intervenant_phone
       GROUP BY r.intervenant_phone, r.intervenant_role, u.full_name
       ORDER BY moyenne ASC`
    );
    const recent = await pool.query(
      `SELECT r.*, u.full_name as patient_name, i.full_name as intervenant_name
       FROM ratings r
       JOIN users u ON u.phone = r.patient_phone
       JOIN users i ON i.phone = r.intervenant_phone
       ORDER BY r.created_at DESC LIMIT 20`
    );
    res.json({ success: true, classement: classement.rows, recent: recent.rows });
  } catch(e) {
    console.error('[ratings/admin]', e.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
