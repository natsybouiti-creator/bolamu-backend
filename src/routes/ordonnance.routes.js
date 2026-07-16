// ⚠️ DÉPRÉCIÉ (unification ordonnances/prescriptions, ARCHITECTURE_SOINS_BOLAMU.md §3) :
// medecin/dashboard.html appelle désormais POST /prescriptions/create. Ces
// routes ne sont plus appelées par aucun frontend actif — conservées pour
// GET /ordonnances/:id (consultation historique BHP) et compatibilité API.
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { bhpAccessMiddleware } = require('../middleware/bhpAccess');
const ordonnanceController = require('../controllers/ordonnance.controller');

// POST /api/v1/ordonnances - Créer ordonnance (médecin)
router.post('/', 
  authMiddleware, 
  ordonnanceController.createOrdonnance
);

// GET /api/v1/ordonnances/:id - Récupérer ordonnance (médecin/pharmacie/patient)
router.get('/:id', 
  authMiddleware, 
  bhpAccessMiddleware(['doctor', 'pharmacie', 'patient']),
  ordonnanceController.getOrdonnance
);

// POST /api/v1/ordonnances/:id/dispense - Dispenser ordonnance (pharmacie)
router.post('/:id/dispense', 
  authMiddleware, 
  ordonnanceController.dispenseOrdonnance
);

module.exports = router;
