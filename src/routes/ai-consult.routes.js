// ============================================================
// BOLAMU — Routes AI Consult (Sprint 9)
// Module d'assistance IA pour médecins — Amina
// ============================================================

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { generateBriefing, analyzeTricolor, generateRenewal } = require('../services/ai-consult.service');

// Middleware pour vérifier que l'utilisateur est un médecin
function doctorOnly(req, res, next) {
  if (req.user?.role !== 'doctor') {
    return res.status(403).json({ success: false, message: 'Accès réservé aux médecins.' });
  }
  next();
}

// ============================================================
// GET /api/v1/ai-consult/briefing/:appointment_id
// Générer un briefing IA pour un RDV (médecin uniquement)
// ============================================================
router.get('/ai-consult/briefing/:appointment_id', authMiddleware, doctorOnly, async (req, res) => {
  const { appointment_id } = req.params;
  const result = await generateBriefing(parseInt(appointment_id), req.user.phone);
  
  if (result.error) {
    return res.json({ success: true, data: result });
  }
  
  return res.json({ success: true, data: result });
});

// ============================================================
// POST /api/v1/ai-consult/tricolor
// Analyse tricolore (interactions, dosages, protocoles)
// ============================================================
router.post('/ai-consult/tricolor', authMiddleware, doctorOnly, async (req, res) => {
  const { diagnosis, medications, patient_phone } = req.body;
  
  if (!diagnosis || !medications || !patient_phone) {
    return res.status(400).json({ success: false, message: 'Champs manquants : diagnosis, medications, patient_phone' });
  }
  
  const result = await analyzeTricolor(diagnosis, medications, patient_phone, req.user.phone);
  return res.json({ success: true, data: result });
});

// ============================================================
// POST /api/v1/ai-consult/renewal/:patient_phone
// Générer une suggestion de renouvellement d'ordonnance
// ============================================================
router.post('/ai-consult/renewal/:patient_phone', authMiddleware, doctorOnly, async (req, res) => {
  const { patient_phone } = req.params;
  const result = await generateRenewal(patient_phone, req.user.phone);
  return res.json({ success: true, data: result });
});

module.exports = router;
