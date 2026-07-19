const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { bhpAccessMiddleware } = require('../middleware/bhpAccess');
const consultationController = require('../controllers/consultation.controller');
const { standardLimiter } = require('../middleware/rateLimiter');

// Middleware pour restreindre aux médecins
const doctorOnly = (req, res, next) => {
    if (req.user?.role !== 'doctor') {
        return res.status(403).json({ success: false, message: 'Accès réservé aux médecins.' });
    }
    next();
};

// POST /api/v1/consultations/open - Ouvrir consultation (médecin)
router.post('/open', 
  authMiddleware, 
  doctorOnly,
  standardLimiter,
  consultationController.openConsultation
);

// POST /api/v1/consultations/:id/close - Fermer consultation (médecin)
router.post('/:id/close', 
  authMiddleware, 
  doctorOnly,
  standardLimiter,
  consultationController.closeConsultation
);

// GET /api/v1/consultations/queue - File d'attente active (médecin)
router.get('/queue', 
  authMiddleware, 
  doctorOnly,
  standardLimiter,
  consultationController.getActiveQueue
);

// GET /api/v1/consultations/patient/:phone/history - Historique patient (médecin/admin)
router.get('/patient/:phone/history', 
  authMiddleware, 
  bhpAccessMiddleware(['doctor', 'admin']),
  consultationController.getPatientHistory
);

module.exports = router;
