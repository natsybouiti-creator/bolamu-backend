// ============================================================
// BOLAMU — Routes Conflits (Sprint 3)
// ============================================================
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth.middleware');
const { normalizePhone } = require('../utils/phone');
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

// Patient : voir ses propres conflits
router.get('/conflicts', authMiddleware, async (req, res) => {
    const phone = req.user.phone;
    const role = req.user.role;

    try {
        if (role === 'patient') {
            // Patient ne voit que ses propres conflits
            const result = await pool.query(
                `SELECT id, reference, sujet, description, statut, priorite, created_at, resolved_at, partner_type, partner_phone
                 FROM conflicts 
                 WHERE patient_phone = $1 
                 ORDER BY created_at DESC`,
                [phone]
            );
            return res.json({ success: true, data: result.rows });
        } else {
            // Admin et autres rôles voient tous les conflits
            return listConflicts(req, res);
        }
    } catch (err) {
        console.error('[conflicts]', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
});

// Patient : voir ses propres conflits (par phone via query param)
router.get('/patient', authMiddleware, async (req, res) => {
    try {
        const phone = normalizePhone(req.query.phone || '') || req.user.phone;
        const result = await pool.query(
            `SELECT id, reference, sujet, description, statut, priorite, created_at, resolved_at, partner_type, partner_phone
             FROM conflicts 
             WHERE patient_phone = $1 
             ORDER BY created_at DESC`,
            [phone]
        );
        res.json({ success: true, conflicts: result.rows });
    } catch (err) {
        console.error('[conflicts/patient]', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── ROUTES ADMIN ─────────────────────────────────────────────────────────────
router.get('/admin/conflicts', authMiddleware, adminOnly, listConflicts);
router.patch('/conflicts/:id/statut', authMiddleware, adminOnly, updateStatut);
router.patch('/conflicts/:id/assign', authMiddleware, adminOnly, assignAgentController);
router.patch('/conflicts/:id/escalade', authMiddleware, adminOnly, escaladeSupAdmin);
router.patch('/conflicts/:id/resolve', authMiddleware, adminOnly, resolveConflict);
router.patch('/conflicts/:id/close', authMiddleware, adminOnly, closeConflict);
router.patch('/conflicts/:id/suspend-partner', authMiddleware, adminOnly, suspendrePartenaireController);

module.exports = router;
