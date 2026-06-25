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
  bhpAccessMiddleware(['medecin', 'pharmacie', 'patient']),
  ordonnanceController.getOrdonnance
);

// POST /api/v1/ordonnances/:id/dispense - Dispenser ordonnance (pharmacie)
router.post('/:id/dispense', 
  authMiddleware, 
  ordonnanceController.dispenseOrdonnance
);

module.exports = router;
