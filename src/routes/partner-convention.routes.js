const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const {
    createConvention,
    activateConvention,
    suspendConvention,
    terminateConvention,
    listConventions
} = require('../controllers/partner-convention.controller');

// Middleware admin only
function adminOnly(req, res, next) {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
    }
    next();
}

// ─── ROUTES CONVENTIONS ───────────────────────────────────────────────────────

// Créer une convention
router.post('/', authMiddleware, adminOnly, createConvention);

// Lister les conventions
router.get('/', authMiddleware, adminOnly, listConventions);

// Activer une convention
router.patch('/:id/activate', authMiddleware, adminOnly, activateConvention);

// Suspendre une convention
router.patch('/:id/suspend', authMiddleware, adminOnly, suspendConvention);

// Résilier une convention
router.patch('/:id/terminate', authMiddleware, adminOnly, terminateConvention);

module.exports = router;
