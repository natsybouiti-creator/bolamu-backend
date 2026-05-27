// ============================================================
// BOLAMU — Routes Secrétariat (Sprint 8)
// ============================================================
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const {
    ajouterFileAttenteController,
    appellerPatientController,
    terminerConsultationController,
    getFileAttenteController,
    bloquerAgendaController,
    getAgendaJourController,
    annulerRDVController,
    getDashboardStatsController
} = require('../controllers/secretariat.controller');

// Middleware RBAC : rôle secrétaire uniquement
const secretaireOnly = async (req, res, next) => {
    if (req.user.role !== 'secretaire') {
        return res.status(403).json({ success: false, message: 'Accès réservé aux secrétaires' });
    }
    next();
};

// ============================================================
// 1. FILE D'ATTENTE
// ============================================================

// POST /api/v1/secretariat/file-attente
// Ajouter patient en file (secretaire)
router.post('/file-attente', authMiddleware, secretaireOnly, ajouterFileAttenteController);

// GET /api/v1/secretariat/file-attente
// Liste file du jour (secretaire)
router.get('/file-attente', authMiddleware, secretaireOnly, getFileAttenteController);

// PATCH /api/v1/secretariat/file-attente/:id/appeler
// Appeler le patient suivant (secretaire)
router.patch('/file-attente/:id/appeler', authMiddleware, secretaireOnly, appellerPatientController);

// PATCH /api/v1/secretariat/file-attente/:id/terminer
// Terminer consultation (secretaire)
router.patch('/file-attente/:id/terminer', authMiddleware, secretaireOnly, terminerConsultationController);

// ============================================================
// 2. AGENDA
// ============================================================

// POST /api/v1/secretariat/agenda/bloquer
// Bloquer créneau agenda (secretaire)
router.post('/agenda/bloquer', authMiddleware, secretaireOnly, bloquerAgendaController);

// GET /api/v1/secretariat/agenda/:doctor_phone/:date
// Agenda du jour d'un médecin (secretaire)
router.get('/agenda/:doctor_phone/:date', authMiddleware, secretaireOnly, getAgendaJourController);

// ============================================================
// 3. RDV
// ============================================================

// DELETE /api/v1/secretariat/rdv/:id
// Soft delete RDV avec motif (secretaire)
router.delete('/rdv/:id', authMiddleware, secretaireOnly, annulerRDVController);

// ============================================================
// 4. STATS DASHBOARD
// ============================================================

// GET /api/v1/secretariat/stats
// Stats dashboard secrétariat (secretaire)
router.get('/stats', authMiddleware, secretaireOnly, getDashboardStatsController);

module.exports = router;
