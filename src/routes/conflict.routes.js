// ============================================================
// BOLAMU — Routes Conflits (Sprint 3)
// ============================================================
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const {
    createConflictController,
    getConflict,
    listConflicts,
    updateStatut,
    addMessageController,
    assignAgentController,
    escaladeSupAdmin,
    resolveConflict,
    closeConflict,
    suspendrePartenaireController
} = require('../controllers/conflict.controller');

// Middleware pour vérifier le rôle admin
function adminOnly(req, res, next) {
    if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
        return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
    }
    next();
}

// Middleware pour vérifier le rôle super_admin
function superAdminOnly(req, res, next) {
    if (req.user?.role !== 'super_admin') {
        return res.status(403).json({ success: false, message: 'Accès réservé au super administrateur.' });
    }
    next();
}

// ─── ROUTES PUBLIQUES / PATIENT ─────────────────────────────────────────────
router.post('/conflicts', authMiddleware, createConflictController);

// ─── ROUTES AUTHENTIFIÉES (tous les rôles) ─────────────────────────────────────
router.get('/conflicts/:id', authMiddleware, getConflict);
router.post('/conflicts/:id/messages', authMiddleware, addMessageController);

// Alias admin pour listing global
router.get('/conflicts', authMiddleware, adminOnly, listConflicts);

// ─── ROUTES ADMIN ─────────────────────────────────────────────────────────────
router.get('/admin/conflicts', authMiddleware, adminOnly, listConflicts);
router.patch('/conflicts/:id/statut', authMiddleware, adminOnly, updateStatut);
router.patch('/conflicts/:id/assign', authMiddleware, adminOnly, assignAgentController);
router.patch('/conflicts/:id/escalade', authMiddleware, adminOnly, escaladeSupAdmin);
router.patch('/conflicts/:id/resolve', authMiddleware, adminOnly, resolveConflict);
router.patch('/conflicts/:id/close', authMiddleware, adminOnly, closeConflict);
router.patch('/conflicts/:id/suspend-partner', authMiddleware, adminOnly, suspendrePartenaireController);

module.exports = router;
