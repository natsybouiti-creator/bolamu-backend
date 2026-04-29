const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const {
    initiateTransaction,
    validateTransaction,
    listTransactionsPartenaire,
    listTransactionsAdmin,
    reconcileTransaction
} = require('../controllers/tiers-payant.controller');

// Middleware admin only
function adminOnly(req, res, next) {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
    }
    next();
}

// ─── ROUTES TIERS PAYANT ───────────────────────────────────────────────────────

// Initier une transaction (pharmacie ou laboratoire)
router.post('/initier', authMiddleware, initiateTransaction);

// Valider une transaction (pharmacie ou laboratoire)
router.patch('/:id/valider', authMiddleware, validateTransaction);

// Lister les transactions du partenaire connecté
router.get('/mes-transactions', authMiddleware, listTransactionsPartenaire);

// Lister toutes les transactions (admin)
router.get('/admin', authMiddleware, adminOnly, listTransactionsAdmin);

// Réconcilier une transaction (admin)
router.patch('/admin/:id/reconcilier', authMiddleware, adminOnly, reconcileTransaction);

module.exports = router;
