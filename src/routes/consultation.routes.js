const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { bhpAccessMiddleware } = require('../middleware/bhpAccess');
const consultationController = require('../controllers/consultation.controller');

// POST /api/v1/consultations/open - Ouvrir consultation (médecin)
router.post('/open', 
  authMiddleware, 
  consultationController.openConsultation
);

// POST /api/v1/consultations/:id/close - Fermer consultation (médecin)
router.post('/:id/close', 
  authMiddleware, 
  consultationController.closeConsultation
);

// GET /api/v1/consultations/queue - File d'attente active (médecin)
router.get('/queue', 
  authMiddleware, 
  consultationController.getActiveQueue
);

// GET /api/v1/consultations/patient/:phone/history - Historique patient (médecin/admin)
router.get('/patient/:phone/history', 
  authMiddleware, 
  bhpAccessMiddleware(['doctor', 'admin']),
  consultationController.getPatientHistory
);

module.exports = router;
