// ============================================================
// BOLAMU — Routes AI Consult (Amina)
// Module d'assistance IA pour médecins via Anthropic API
// ============================================================

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const ctrl = require('../controllers/ai-consult.controller');

// Middleware pour vérifier que l'utilisateur est un médecin
function doctorOnly(req, res, next) {
  if (req.user?.role !== 'doctor') {
    return res.status(403).json({ success: false, message: 'Accès réservé aux médecins.' });
  }
  next();
}

// POST /api/v1/ai-consult/briefing — Briefing pré-consultation
router.post('/briefing', authMiddleware, doctorOnly, ctrl.briefingConsultation);

// POST /api/v1/ai-consult/rediger-cr — Compte rendu SOAP
router.post('/rediger-cr', authMiddleware, doctorOnly, ctrl.redigerCompteRendu);

// POST /api/v1/ai-consult/suggerer-ordonnance — Suggestion ordonnance SSP
router.post('/suggerer-ordonnance', authMiddleware, doctorOnly, ctrl.suggererOrdonnance);

module.exports = router;
